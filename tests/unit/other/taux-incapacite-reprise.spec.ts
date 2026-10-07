import { expect } from "vitest"
import Migration from "@backend/lib/migrations/simulations/to-v18.js"
import { parametersList } from "@lib/openfisca-parameters.js"
import { generateSituation } from "@lib/situations.js"
import { generateAllSteps } from "@lib/state/generator.js"
import { isStepAnswered } from "@lib/answers.js"

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
      value: "inactif",
    },
    {
      entityName: "individu",
      id: "demandeur",
      fieldName: "handicap",
      value: true,
    },
    {
      entityName: "individu",
      id: "demandeur",
      fieldName: "taux_incapacite",
      value: taux,
    },
  ]
  return {
    dateDeValeur: new Date("2026-08-15"),
    version: 17,
    answers: { all: answers, current: answers },
  }
}

function etapeTauxIncapacite(simulation) {
  const situation = generateSituation(simulation, true)
  return generateAllSteps(situation, parametersList).find(
    (step: any) =>
      step.variable === "taux_incapacite" && step.id === "demandeur",
  )
}

// Le récapitulatif propose « Continuer » vers la première étape sans réponse ;
// c'est ce qui fait reposer la question au lieu d'amputer la personne de son
// droit.
describe("reprise du parcours après migration", () => {
  it("laisse l'étape du taux d'incapacité active et sans réponse", () => {
    const simulation: any = Migration.apply(simulationEnregistree(null))
    const step: any = etapeTauxIncapacite(simulation)

    expect(step?.isActive).toBe(true)
    expect(isStepAnswered(simulation.answers.all, step)).toBe(false)
  })

  it("considère l'étape répondue quand le taux est exploitable", () => {
    const simulation: any = Migration.apply(simulationEnregistree(0.9))
    const step: any = etapeTauxIncapacite(simulation)

    expect(step?.isActive).toBe(true)
    expect(isStepAnswered(simulation.answers.all, step)).toBe(true)
  })
})
