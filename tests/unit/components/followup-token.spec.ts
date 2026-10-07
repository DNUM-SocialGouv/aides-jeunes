import { expect, vi, beforeEach } from "vitest"
import { mount } from "@vue/test-utils"
import { setActivePinia, createPinia } from "pinia"
import axios from "axios"

import { useStore } from "@/stores/index.js"
import RecapForm from "@/components/recap-email-and-sms-form.vue"
import ComeBackLater from "@/views/simulation/revenir-plus-tard.vue"

vi.mock("vue-router", () => {
  const route = {
    fullPath: "/simulation/resultats",
    path: "/simulation/resultats",
  }
  return {
    useRouter: () => ({
      currentRoute: { value: route },
      push: vi.fn(),
      go: vi.fn(),
      replace: vi.fn(),
    }),
    useRoute: () => route,
  }
})

vi.mock("@/router", () => ({
  default: {
    currentRoute: { value: { fullPath: "/x", path: "/x" } },
    push: vi.fn(),
    go: vi.fn(),
    replace: vi.fn(),
  },
}))

// Le cookie d'accès est un cookie tiers quand le simulateur est intégré en
// iframe : Safari le bloque sans exception. Ces enregistrements doivent donc
// s'authentifier par l'en-tête, seul canal disponible dans tous les contextes.
describe("le suivi s'authentifie par le jeton, pas par le cookie", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it("porte le jeton depuis le formulaire de récapitulatif", async () => {
    const store = useStore()
    store.setSimulationToken("TOKEN-A")
    store.setResults({
      _id: "sim-1",
      droitsEligibles: [],
      droitsInjectes: [],
    } as any)
    store.calculs.dirty = false

    const post = vi
      .spyOn(axios, "post")
      .mockResolvedValue({ data: { result: "OK" } } as any)

    const wrapper = mount(RecapForm, {
      global: { stubs: { WarningMessage: true } },
    })
    await wrapper.find("input#email").setValue("prenom.nom@beta.gouv.fr")
    await wrapper.find("form").trigger("submit")
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(post).toHaveBeenCalledOnce()
    const [url, , config] = post.mock.calls[0]
    expect(url).toBe("/api/simulation/sim-1/followup")
    expect((config as any)?.headers?.Authorization).toBe("Bearer TOKEN-A")
  })

  it("porte le jeton issu du save() qui précède, depuis « revenir plus tard »", async () => {
    const store = useStore()
    const post = vi
      .spyOn(axios, "post")
      .mockImplementation(async (url: string) => {
        if (url === "/api/simulation") {
          return { data: { _id: "sim-2", token: "TOKEN-B" } } as any
        }
        return {
          data: { simulationRecapUrl: "https://exemple.test/s/t/abc" },
        } as any
      })

    const wrapper = mount(ComeBackLater)
    await wrapper
      .find('[data-testid="temporary-save-simulation-button"]')
      .trigger("click")
    await new Promise((resolve) => setTimeout(resolve, 0))

    const followupCall = post.mock.calls.find(([url]) =>
      String(url).includes("/followup"),
    )
    expect(followupCall?.[0]).toBe("/api/simulation/sim-2/followup")
    expect((followupCall?.[2] as any)?.headers?.Authorization).toBe(
      "Bearer TOKEN-B",
    )
  })

  it("conserve le jeton quand une simulation est rechargée", () => {
    const store = useStore()
    store.setSimulationToken("TOKEN-C")

    // Le serveur nomme le jeton `token` ; sans reprise explicite, l'affectation
    // en bloc de `reset` l'effacerait et l'en-tête repartirait vide.
    store.reset({
      _id: "sim-3",
      token: "TOKEN-D",
      answers: store.simulation.answers,
    } as any)

    expect(store.getSimulationToken).toBe("TOKEN-D")
    expect(store.authHeaders).toEqual({ Authorization: "Bearer TOKEN-D" })
  })

  it("n'envoie aucun en-tête d'autorisation en l'absence de jeton", () => {
    const store = useStore()
    expect(store.getSimulationToken).toBeUndefined()
    expect(store.authHeaders).toBeUndefined()
  })
})
