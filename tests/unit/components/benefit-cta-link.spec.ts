import { expect, vi } from "vitest"
import { mount } from "@vue/test-utils"
import BenefitCtaLink from "@/components/benefit-cta-link.vue"
import { APPOINTMENT_LABEL, CTALabel } from "@lib/enums/cta.js"

vi.mock("vue-router", () => ({ useRouter: () => ({}) }))
vi.mock("@/stores/index.js", () => ({ useStore: () => ({}) }))
vi.mock("@/composables/use-benefits.js", () => ({
  useBenefits: () => ({ benefits: [] }),
}))

function mountLink(is_appointment: boolean) {
  return mount(BenefitCtaLink, {
    global: { directives: { analytics: {} } },
    props: {
      benefit: { prefix: "l’", label: "aide", is_appointment } as any,
      type: CTALabel.Teleservice,
      link: "https://example.org",
    },
  })
}

describe("benefit-cta-link.vue", () => {
  it("affiche « Prendre RDV » quand is_appointment est vrai", () => {
    const a = mountLink(true).find("a")
    expect(a.text()).toBe(APPOINTMENT_LABEL)
    expect(a.attributes("aria-label")).toBe(
      `${APPOINTMENT_LABEL} pour l’aide - Nouvelle fenêtre`,
    )
  })

  it("affiche le libellé téléservice sinon", () => {
    const a = mountLink(false).find("a")
    expect(a.text()).toBe("Faire une demande en ligne")
  })
})
