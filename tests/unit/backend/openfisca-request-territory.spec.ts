import { expect } from "vitest"

import { buildOpenFiscaRequest } from "@backend/lib/openfisca/mapping/index.js"
import { generateSituation } from "@lib/situations.js"
import benefits from "@root/data/all.js"
import { isOutOfTerritory } from "@lib/benefits/territory.js"

function situationFor(commune: Record<string, string> | null) {
  const situation: any = generateSituation({
    answers: {
      all: [
        {
          entityName: "individu",
          id: "demandeur",
          fieldName: "date_naissance",
          value: "2003-05-01",
        },
        {
          entityName: "menage",
          fieldName: "depcom",
          value: commune ?? { depcom: "69123" },
        },
        {
          entityName: "individu",
          id: "demandeur",
          fieldName: "salaire_imposable",
          value: 1200,
        },
      ],
      current: [],
    },
    dateDeValeur: new Date("2026-08-01"),
  } as any)

  if (commune) {
    Object.assign(situation.menage, commune)
  }
  return situation
}

const LYON = {
  depcom: "69123",
  _departement: "69",
  _region: "84",
  _epci: "200046977",
}

function requestedVariables(request: any): Set<string> {
  const names = new Set<string>()
  for (const items of Object.values(request)) {
    if (!items || typeof items !== "object") continue
    for (const item of Object.values(items as any)) {
      for (const [key, periods] of Object.entries((item as any) || {})) {
        if (periods && typeof periods === "object") names.add(key)
      }
    }
  }
  return names
}

describe("périmètre territorial de la requête OpenFisca", () => {
  const openfiscaBenefits = (benefits.all as any[]).filter(
    (benefit) => (benefit.source || "openfisca") === "openfisca",
  )

  it("ne demande aucune aide portée par une collectivité dont l'usager ne relève pas", () => {
    const situation = situationFor(LYON)
    const demandees = requestedVariables(buildOpenFiscaRequest(situation))

    const indues = openfiscaBenefits
      .filter((benefit) => isOutOfTerritory(benefit, situation.menage))
      .map((benefit) => benefit.openfisca_eligibility_source || benefit.id)
      .filter((name) => demandees.has(name))

    expect(indues).toEqual([])
  })

  it("continue de demander les aides du territoire de l'usager", () => {
    const situation = situationFor(LYON)
    const demandees = requestedVariables(buildOpenFiscaRequest(situation))

    const duTerritoire = openfiscaBenefits.filter(
      (benefit) =>
        ["commune", "departement", "region", "epci"].includes(
          benefit.institution?.type,
        ) && !isOutOfTerritory(benefit, situation.menage),
    )

    // Le catalogue évolue : on vérifie qu'aucune de ces aides n'a disparu de la
    // requête, sans figer leur nombre.
    const manquantes = duTerritoire
      .map((benefit) => benefit.openfisca_eligibility_source || benefit.id)
      .filter((name) => !demandees.has(name))

    expect(manquantes).toEqual([])
  })

  it("allège réellement la requête", () => {
    const complete = requestedVariables(
      buildOpenFiscaRequest(situationFor(null)),
    )
    const ciblee = requestedVariables(buildOpenFiscaRequest(situationFor(LYON)))

    expect(ciblee.size).toBeLessThan(complete.size)
  })

  it("n'écarte aucun échelon supra-communal quand la commune n'est pas enrichie", () => {
    // Sans département, région ni EPCI, ces échelons ne sont pas décidables :
    // en écarter une aide priverait l'usager d'un droit. On éprouve le filtre
    // lui-même sur tout le catalogue, la requête pouvant omettre une aide pour
    // d'autres raisons légitimes.
    const situation = situationFor({ depcom: "69123" })

    const ecartees = openfiscaBenefits.filter(
      (benefit) =>
        ["departement", "region", "epci"].includes(benefit.institution?.type) &&
        isOutOfTerritory(benefit, situation.menage),
    )

    expect(ecartees).toEqual([])
  })
})
