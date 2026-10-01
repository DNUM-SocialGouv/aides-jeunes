import { expect } from "vitest"
import {
  isAttachedToInstitution,
  isOutOfTerritory,
} from "@lib/benefits/territory.js"

const lyon = {
  depcom: "69123",
  _departement: "69",
  _region: "84",
  _epci: "200046977",
} as any

describe("territoire d'une aide", () => {
  describe("isOutOfTerritory", () => {
    it.each([
      ["commune voisine", { type: "commune", code_insee: "69381" }],
      ["autre département", { type: "departement", code_insee: "75" }],
      ["autre région", { type: "region", code_insee: "11" }],
      ["autre EPCI", { type: "epci", code_siren: "200054781" }],
    ])("exclut une aide portée par %s", (_libelle, institution) => {
      expect(isOutOfTerritory({ institution }, lyon)).toBe(true)
    })

    it.each([
      ["la commune", { type: "commune", code_insee: "69123" }],
      ["le département", { type: "departement", code_insee: "69" }],
      ["la région", { type: "region", code_insee: "84" }],
      ["l'EPCI", { type: "epci", code_siren: "200046977" }],
    ])("conserve une aide portée par %s de l'usager", (_l, institution) => {
      expect(isOutOfTerritory({ institution }, lyon)).toBe(false)
    })

    // Dans le doute, on conserve : une aide écartée à tort est un droit que
    // l'usager ne verra jamais.
    it.each([
      ["institution nationale", { institution: { type: "national" } }, lyon],
      ["type inconnu", { institution: { type: "syndicat" } }, lyon],
      ["institution absente", {}, lyon],
      [
        "code d'institution manquant",
        { institution: { type: "commune" } },
        lyon,
      ],
      [
        "EPCI de l'usager inconnu",
        { institution: { type: "epci", code_siren: "200054781" } },
        { ...lyon, _epci: undefined },
      ],
      [
        "département de l'usager inconnu",
        { institution: { type: "departement", code_insee: "75" } },
        { ...lyon, _departement: undefined },
      ],
      [
        "commune non renseignée",
        { institution: { type: "commune", code_insee: "69381" } },
        {},
      ],
      [
        "ménage absent",
        { institution: { type: "commune", code_insee: "69381" } },
        undefined,
      ],
    ])("conserve l'aide quand %s", (_l, benefit, menage) => {
      expect(isOutOfTerritory(benefit as any, menage as any)).toBe(false)
    })
  })

  describe("isAttachedToInstitution", () => {
    it("reconnaît chaque échelon territorial", () => {
      expect(
        isAttachedToInstitution({ type: "commune", code_insee: "69123" }, lyon),
      ).toBe(true)
      expect(
        isAttachedToInstitution(
          { type: "departement", code_insee: "69" },
          lyon,
        ),
      ).toBe(true)
      expect(
        isAttachedToInstitution({ type: "region", code_insee: "84" }, lyon),
      ).toBe(true)
      expect(
        isAttachedToInstitution(
          { type: "epci", code_siren: "200046977" },
          lyon,
        ),
      ).toBe(true)
    })

    it("rejette un autre territoire et un type non territorial", () => {
      expect(
        isAttachedToInstitution({ type: "commune", code_insee: "75056" }, lyon),
      ).toBe(false)
      expect(isAttachedToInstitution({ type: "national" }, lyon)).toBe(false)
    })
  })
})
