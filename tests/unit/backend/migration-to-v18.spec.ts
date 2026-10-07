import { expect } from "vitest"

import Migration from "@backend/lib/migrations/simulations/to-v18.js"

const reponse = (value: unknown) => ({
  entityName: "individu",
  id: "enfant_0",
  fieldName: "taux_incapacite",
  value,
})
const handicap = {
  entityName: "individu",
  id: "enfant_0",
  fieldName: "handicap",
  value: true,
}

const simulationAvec = (taux: unknown) => ({
  answers: {
    all: [handicap, reponse(taux)],
    current: [handicap, reponse(taux)],
  },
})

describe("Migration to-v18", () => {
  it("retire un taux d'incapacité enregistré sans valeur exploitable", () => {
    const result = Migration.apply(simulationAvec(null))

    // La question redevient sans réponse, donc reposée ; le handicap déclaré
    // reste acquis.
    expect(result.answers.all).toEqual([handicap])
    expect(result.answers.current).toEqual([handicap])
  })

  it("conserve un taux d'incapacité renseigné", () => {
    const result = Migration.apply(simulationAvec(0.65))

    expect(result.answers.all).toEqual([handicap, reponse(0.65)])
    expect(result.answers.current).toEqual([handicap, reponse(0.65)])
  })

  it("conserve le taux le plus bas, qui vaut zéro à la lecture booléenne", () => {
    const result = Migration.apply(simulationAvec(0))

    expect(result.answers.all).toEqual([handicap, reponse(0)])
  })

  it("retire un NaN, si jamais il atteint la base sans passer par JSON", () => {
    const result = Migration.apply(simulationAvec(NaN))

    expect(result.answers.all).toEqual([handicap])
  })

  // `POST /api/simulation` est public et le schéma déclare `value: Object` :
  // une chaîne peut donc arriver d'une intégration partenaire. OpenFisca
  // l'accepte — vérifié : « 0.9 » rend la même AAH que 0.9. La retirer priverait
  // cette personne de son droit sans qu'il y ait eu de corruption.
  it("conserve un taux transmis sous forme de chaîne", () => {
    const result = Migration.apply(simulationAvec("0.9"))

    expect(result.answers.all).toEqual([handicap, reponse("0.9")])
  })

  it("ne touche pas aux autres réponses nulles", () => {
    const autre = {
      entityName: "parents",
      fieldName: "nbptr",
      value: null,
    }
    const result = Migration.apply({
      answers: { all: [autre], current: [autre] },
    })

    expect(result.answers.all).toEqual([autre])
  })
})
