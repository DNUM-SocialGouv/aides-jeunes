import { expect, vi, beforeEach, afterEach } from "vitest"

const { iframeResize } = vi.hoisted(() => ({ iframeResize: vi.fn() }))
vi.mock("@iframe-resizer/parent", () => ({ default: iframeResize }))

import { mountSimulator } from "@root/iframes/iframe-integration.js"

const BASE_URL = "https://mes-aides.example.fr"

let observed: HTMLElement[]
let trigger: (entries: { isIntersecting: boolean }[]) => void
let disconnect: ReturnType<typeof vi.fn>

function fakeObserver() {
  observed = []
  disconnect = vi.fn()
  return class {
    constructor(callback) {
      trigger = callback
    }
    observe(element: HTMLElement) {
      observed.push(element)
    }
    disconnect = disconnect
  }
}

function addScript(dataset: Record<string, string> = {}) {
  const script = document.createElement("script")
  for (const [key, value] of Object.entries(dataset)) {
    script.dataset[key] = value
  }
  document.body.appendChild(script)
  return script
}

describe("intégration iframe", () => {
  beforeEach(() => {
    vi.stubEnv("BASE_URL", BASE_URL)
    vi.stubEnv("IFRAME_TITLE", "Évaluez vos droits")
    document.body.innerHTML = ""
    iframeResize.mockClear()
    ;(window as any).IntersectionObserver = fakeObserver()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    delete (window as any).IntersectionObserver
  })

  it("insère l'iframe sans la charger tant qu'elle n'est pas approchée", () => {
    const iframe = mountSimulator(addScript())

    expect(document.querySelector("#simulateur")).toBe(iframe)
    // `src` vide : aucune requête n'est émise vers le simulateur.
    expect(iframe.getAttribute("src")).toBeNull()
    expect(iframeResize).not.toHaveBeenCalled()
    expect(observed).toEqual([iframe])
  })

  it("charge l'iframe à son entrée dans le champ de vision", () => {
    const iframe = mountSimulator(addScript())

    trigger([{ isIntersecting: true }])

    expect(iframe.src).toContain(`${BASE_URL}/simulation`)
    expect(iframe.src).toContain("iframe=true")
    expect(iframeResize).toHaveBeenCalledTimes(1)
    expect(disconnect).toHaveBeenCalled()
  })

  it("ne charge rien tant que l'iframe reste hors du champ de vision", () => {
    const iframe = mountSimulator(addScript())

    trigger([{ isIntersecting: false }])

    expect(iframe.getAttribute("src")).toBeNull()
    expect(iframeResize).not.toHaveBeenCalled()
  })

  it("ne charge qu'une fois même si l'observateur se déclenche plusieurs fois", () => {
    mountSimulator(addScript())

    trigger([{ isIntersecting: true }])
    trigger([{ isIntersecting: true }])

    expect(iframeResize).toHaveBeenCalledTimes(1)
  })

  it("charge immédiatement avec data-eager", () => {
    const iframe = mountSimulator(addScript({ eager: "" }))

    expect(iframe.src).toContain(`${BASE_URL}/simulation`)
    expect(iframeResize).toHaveBeenCalledTimes(1)
    expect(observed).toEqual([])
  })

  it("insère l'iframe quand le script est dans le head", () => {
    const script = document.createElement("script")
    document.head.appendChild(script)

    const iframe = mountSimulator(script)

    expect(iframe.parentElement).toBe(document.body)
    expect(observed).toEqual([iframe])
  })

  // Repli minimal : `iframeResize` dépend lui aussi d'`IntersectionObserver` et
  // échouera de toute façon. Ce chemin garantit seulement que l'iframe reçoit
  // une source, comme avant le chargement différé.
  it("charge immédiatement si IntersectionObserver est absent", () => {
    delete (window as any).IntersectionObserver

    const iframe = mountSimulator(addScript())

    expect(iframe.src).toContain(`${BASE_URL}/simulation`)
    expect(iframeResize).toHaveBeenCalledTimes(1)
  })

  it("conserve les paramètres d'intégration existants", () => {
    const iframe = mountSimulator(
      addScript({ fromHome: "", withLogo: "", theme: "dsfr" }),
    )
    trigger([{ isIntersecting: true }])

    const url = new URL(iframe.src)
    expect(url.pathname).toBe("/")
    expect(url.searchParams.get("data-with-logo")).toBe("true")
    expect(url.searchParams.get("theme")).toBe("dsfr")
    expect(url.searchParams.get("utm_source")).toBe(
      `iframe@${window.location.hostname}`,
    )
    expect(url.searchParams.get("utm_term")).toBe(window.location.pathname)
  })

  it("pose la hauteur dès l'insertion, avant tout chargement", () => {
    const iframe = mountSimulator(addScript())

    expect(iframe.getAttribute("style")).toContain("height: 700px")
  })
})
