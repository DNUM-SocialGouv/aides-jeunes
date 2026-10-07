import { expect } from "vitest"
import Migration from "@backend/lib/migrations/simulations/to-v18.js"
import subject from "@root/backend/lib/openfisca/mapping/index.js"
import { generateSituation } from "@lib/situations.js"

// Règle d'OpenFisca, telle qu'écrite dans openfisca-core
// (`SimulationBuilder.init_variable_values`) : toute valeur de variable doit
// être un objet indexé par période, sans quoi la requête *entière* est refusée
// en 400 — « Can't deal with type: expected object ».
//
// Les listes d'identifiants (rôles d'entité) sont lues autrement ; `undefined`
// disparaît à la sérialisation JSON et n'atteint jamais OpenFisca.
function variablesRefuseesParOpenfisca(request: any): string[] {
  const refusees: string[] = []
  for (const [entityPlural, instances] of Object.entries<any>(request)) {
    for (const [instanceId, instance] of Object.entries<any>(instances)) {
      for (const [variableName, value] of Object.entries<any>(instance)) {
        if (Array.isArray(value) || value === undefined) {
          continue
        }
        if (typeof value !== "object" || value === null) {
          refusees.push(`${entityPlural}.${instanceId}.${variableName}`)
        }
      }
    }
  }
  return refusees
}

// Une simulation telle qu'elle est relue en base : `taux_incapacite` y vaut
// `null`, ce que JSON écrit d'un NaN.
function simulationEnregistree(taux: unknown) {
  const answers = [
    {
      entityName: "individu",
      id: "demandeur",
      fieldName: "date_naissance",
      value: "1995-01-01",
    },
    {
      entityName: "individu",
      id: "demandeur",
      fieldName: "activite",
      value: "salarie",
    },
    {
      entityName: "individu",
      id: "enfant_0",
      fieldName: "date_naissance",
      value: "2015-01-01",
    },
    {
      entityName: "individu",
      id: "enfant_0",
      fieldName: "handicap",
      value: true,
    },
    {
      entityName: "individu",
      id: "enfant_0",
      fieldName: "taux_incapacite",
      value: taux,
    },
    { entityName: "menage", fieldName: "loyer", value: { loyer: 700 } },
  ]
  return {
    dateDeValeur: new Date("2026-08-15"),
    version: 17,
    enfants: [0],
    answers: { all: answers, current: answers },
  }
}

function requeteDepuis(simulation) {
  return subject.buildOpenFiscaRequest(generateSituation(simulation))
}

describe("taux d'incapacité enregistré sans valeur exploitable", () => {
  it("est refusé par OpenFisca tant qu'il figure dans la simulation", () => {
    const request = requeteDepuis(simulationEnregistree(null))

    expect(variablesRefuseesParOpenfisca(request)).toEqual([
      "individus.enfant_0.taux_incapacite",
    ])
  })

  it("disparaît de la requête une fois la simulation migrée", () => {
    const request = requeteDepuis(Migration.apply(simulationEnregistree(null)))

    expect(variablesRefuseesParOpenfisca(request)).toEqual([])
    expect(request.individus.enfant_0).not.toHaveProperty("taux_incapacite")
    // Le handicap déclaré reste transmis : périodes écrites en dur.
    expect(request.individus.enfant_0.handicap).toEqual({
      "2026-08": true,
      "2026-07": true,
      "2026-06": true,
      "2026-05": true,
    })
  })

  it("laisse intact un taux renseigné", () => {
    const request = requeteDepuis(Migration.apply(simulationEnregistree(0.9)))

    expect(variablesRefuseesParOpenfisca(request)).toEqual([])
    expect(request.individus.enfant_0.taux_incapacite).toEqual({
      "2026-08": 0.9,
      "2026-07": 0.9,
      "2026-06": 0.9,
      "2026-05": 0.9,
    })
  })
})
