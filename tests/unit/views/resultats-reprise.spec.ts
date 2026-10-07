import { expect, vi, beforeEach, afterEach } from "vitest"
import { mount } from "@vue/test-utils"
import { setActivePinia, createPinia } from "pinia"
import axios from "axios"

import { useStore } from "@/stores/index.js"
import { SimulationStatus } from "@lib/enums/simulation.js"
import ResultatsWrapper from "@/views/simulation/resultats/resultats-wrapper.vue"

const { route, router } = vi.hoisted(() => ({
  route: {
    fullPath: "/simulation/resultats",
    path: "/simulation/resultats",
    query: {} as Record<string, string>,
    params: {} as Record<string, string>,
  },
  router: {
    currentRoute: {
      value: {
        fullPath: "/simulation/resultats",
        name: "resultats",
        meta: {},
        query: {} as Record<string, string>,
      },
    },
    push: vi.fn(),
    go: vi.fn(),
    replace: vi.fn(),
  },
}))

vi.mock("vue-router", () => ({
  useRouter: () => router,
  useRoute: () => route,
}))

const ETAPE_TAUX = "/simulation/individu/demandeur/taux_incapacite"

const reponse = (fieldName: string, value: unknown) => ({
  entityName: "individu",
  id: "demandeur",
  fieldName,
  value,
})

function simulation(reponsesTaux: any[]) {
  const answers = [
    reponse("date_naissance", "1995-01-01"),
    reponse("activite", "inactif"),
    reponse("handicap", true),
    ...reponsesTaux,
  ]
  return {
    _id: "sim-1",
    token: "TOKEN",
    dateDeValeur: new Date("2026-08-15"),
    version: 18,
    answers: { all: answers, current: answers },
  }
}

// Simulation telle que le serveur la renvoie après la migration v18 : la
// réponse au taux d'incapacité en a été retirée, le handicap déclaré demeure.
const simulationMigree = (avecTaux = false) =>
  simulation(avecTaux ? [reponse("taux_incapacite", 0.9)] : [])

// Simulation née après la migration : la réponse est là, mais sa valeur est
// perdue.
const simulationAvecTaux = (taux: unknown) =>
  simulation([reponse("taux_incapacite", taux)])

function monter() {
  return mount(ResultatsWrapper, {
    global: {
      stubs: { RouterView: true, LoadingModal: true, BackButton: true },
    },
  })
}

const attendreMontage = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("résultats : reprise d'une réponse retirée", () => {
  let get: any

  // Un calcul OpenFisca complet pour une page qui ne sera jamais affichée pèse
  // sur le service même dont la saturation est en cause.
  const aCalculeLesResultats = () =>
    get.mock.calls.some(([url]) => String(url).includes("/results"))

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    router.replace.mockClear()
    route.query = {}
    router.currentRoute.value.query = {}
    document.cookie = "lastestSimulation=; max-age=0"
    get = vi.spyOn(axios, "get").mockResolvedValue({ data: {} } as any)
  })

  afterEach(() => {
    document.cookie = "lastestSimulation=; max-age=0"
  })

  // 1. Lien de relance par courriel : /simulation/redirect a déjà chargé la
  //    simulation dans le magasin avant d'atteindre les résultats.
  it("repose la question quand la simulation est déjà chargée", async () => {
    const store = useStore()
    store.reset(simulationMigree() as any)
    store.setSimulationId("sim-1")

    monter()
    await attendreMontage()

    expect(router.replace).toHaveBeenCalledWith(ETAPE_TAUX)
    expect(aCalculeLesResultats()).toBe(false)
  })

  // 2. Cookie `lastestSimulation` : la simulation est chargée pendant le montage.
  it("repose la question après restauration par le cookie", async () => {
    document.cookie = "lastestSimulation=sim-1"
    get.mockResolvedValue({ data: simulationMigree() } as any)

    monter()
    await attendreMontage()
    await attendreMontage()

    expect(router.replace).toHaveBeenCalledWith(ETAPE_TAUX)
    expect(aCalculeLesResultats()).toBe(false)
  })

  // 3. `?simulationId=` dans l'adresse.
  it("repose la question après chargement par ?simulationId=", async () => {
    route.query = { simulationId: "sim-1" }
    get.mockResolvedValue({ data: simulationMigree() } as any)

    monter()
    await attendreMontage()
    await attendreMontage()

    expect(router.replace).toHaveBeenCalledWith(ETAPE_TAUX)
    expect(aCalculeLesResultats()).toBe(false)
  })

  // Une simulation créée après la migration v18 ne repasse pas par elle : sa
  // réponse perdue lui reste, et la garde doit la reconnaître à sa valeur.
  it("repose la question quand la réponse existe mais a perdu sa valeur", async () => {
    const store = useStore()
    store.reset(simulationAvecTaux(null) as any)
    store.setSimulationId("sim-1")

    monter()
    await attendreMontage()

    expect(router.replace).toHaveBeenCalledWith(ETAPE_TAUX)
    expect(aCalculeLesResultats()).toBe(false)
  })

  it("n'interrompt pas une simulation dont le taux est renseigné", async () => {
    const store = useStore()
    store.reset(simulationMigree(true) as any)
    store.setSimulationId("sim-1")

    monter()
    await attendreMontage()

    expect(router.replace).not.toHaveBeenCalledWith(ETAPE_TAUX)
    expect(aCalculeLesResultats()).toBe(true)
  })

  // Une simulation anonymisée n'a plus de réponses à reposer : ses résultats
  // sont relus tels qu'ils ont été calculés.
  it("n'interrompt pas une simulation anonymisée", async () => {
    const store = useStore()
    store.reset({
      ...simulationMigree(),
      status: SimulationStatus.Anonymized,
    } as any)
    store.setSimulationId("sim-1")

    monter()
    await attendreMontage()

    expect(router.replace).not.toHaveBeenCalledWith(ETAPE_TAUX)
  })
})
