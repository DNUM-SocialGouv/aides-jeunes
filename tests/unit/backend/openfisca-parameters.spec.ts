import { expect, vi, beforeEach, afterEach } from "vitest"

const getPromise = vi.fn()

vi.mock("@backend/lib/openfisca/getter.js", () => ({
  default: { get: vi.fn(), getPromise: (item) => getPromise(item) },
}))

const PARAMETRE_TAUX_MAX =
  "prestations_sociales.prestations_etat_de_sante.invalidite.aah.taux_capacite.taux_incapacite"

// Une valeur volontairement différente du repli codé en dur (0.8) : la
// distinguer prouve que le paramètre vient bien d'OpenFisca.
const TAUX_SERVI_PAR_OPENFISCA = 0.77

function reponseOpenfisca(item: string) {
  return {
    id: item.replace("/parameter/", ""),
    values: { "2019-01-01": TAUX_SERVI_PAR_OPENFISCA },
  }
}

async function importParameters() {
  return import("@backend/lib/openfisca/parameters.js")
}

describe("paramètres OpenFisca", () => {
  beforeEach(() => {
    vi.resetModules()
    getPromise.mockReset()
    vi.spyOn(console, "error").mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // Sans paramètres, la question du taux d'incapacité ne peut plus construire
  // ses paliers : deux de ses trois options valent NaN.
  it("sert des valeurs exploitables même quand OpenFisca est injoignable", async () => {
    getPromise.mockRejectedValue(new Error("OF maybe offline"))
    const { getParametersAsync, parametersList } = await importParameters()

    const parameters = await getParametersAsync(new Date("2026-08-15"))

    expect(Object.keys(parameters).sort()).toEqual(
      Object.keys(parametersList).sort(),
    )
    expect(
      Object.values(parameters).every((value) => Number.isFinite(value)),
    ).toBe(true)
  })

  it("sert la valeur d'OpenFisca dès qu'elle est disponible", async () => {
    getPromise.mockImplementation(async (item: string) =>
      reponseOpenfisca(item),
    )
    const { getParametersAsync } = await importParameters()

    const parameters = await getParametersAsync(new Date("2026-08-15"))

    expect(parameters[PARAMETRE_TAUX_MAX]).toBe(TAUX_SERVI_PAR_OPENFISCA)
  })

  it("réessaie après le délai de reprise", async () => {
    vi.useFakeTimers()
    getPromise.mockRejectedValue(new Error("OF maybe offline"))
    const { getParametersAsync } = await importParameters()

    const enPanne = await getParametersAsync(new Date("2026-08-15"))
    expect(enPanne[PARAMETRE_TAUX_MAX]).not.toBe(TAUX_SERVI_PAR_OPENFISCA)

    getPromise.mockImplementation(async (item: string) =>
      reponseOpenfisca(item),
    )
    await vi.advanceTimersByTimeAsync(30_000)
    const retabli = await getParametersAsync(new Date("2026-08-15"))

    expect(retabli[PARAMETRE_TAUX_MAX]).toBe(TAUX_SERVI_PAR_OPENFISCA)
  })

  // `getParameters` est appelé une fois par droit calculé, donc en continu.
  // Les appels sont entrelacés avec l'horloge : les grouper avant toute avance
  // du temps rendrait le test insensible à la suppression du délai.
  it("ne relance pas la requête à chaque appel pendant le délai de reprise", async () => {
    vi.useFakeTimers()
    getPromise.mockRejectedValue(new Error("OF maybe offline"))
    const { getParameters, parametersList } = await importParameters()
    const parAppel = Object.keys(parametersList).length

    for (let seconde = 0; seconde < 29; seconde++) {
      getParameters(new Date("2026-08-15"))
      await vi.advanceTimersByTimeAsync(1_000)
    }

    // Une seule tentative en vingt-neuf secondes.
    expect(getPromise).toHaveBeenCalledTimes(parAppel)

    // Passé le délai, une nouvelle tentative — et une seule.
    await vi.advanceTimersByTimeAsync(2_000)
    getParameters(new Date("2026-08-15"))
    await vi.advanceTimersByTimeAsync(1_000)
    getParameters(new Date("2026-08-15"))
    await vi.advanceTimersByTimeAsync(1_000)

    expect(getPromise).toHaveBeenCalledTimes(2 * parAppel)
  })
})
