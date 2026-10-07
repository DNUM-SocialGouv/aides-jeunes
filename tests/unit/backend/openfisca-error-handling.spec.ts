import { expect, vi } from "vitest"

vi.mock("axios", () => ({
  default: { post: vi.fn(), defaults: {} },
}))

// Le chargement du module lit le système de fichiers, ce que l'environnement
// de test ne permet pas ; seul `apply` est utilisé par le contrôleur.
vi.mock("@backend/lib/migrations/index.js", () => ({
  apply: (simulation) => simulation,
}))

import axios from "axios"
import config from "@backend/config/index.js"
import { sendToOpenfisca } from "@backend/lib/openfisca/index.js"
import simulationController from "@backend/controllers/simulation.js"
import teleservices from "@backend/controllers/teleservices/index.js"

const PERSONAL_VALUE = "<img src=x onerror=alert(1)>"

// Un AxiosError d'abandon : pas de `response`, mais `config` porte la requête
// envoyée — donc la situation personnelle — et `stack` les chemins du serveur.
function abortError() {
  return Object.assign(new Error("timeout of 25000ms exceeded"), {
    name: "AxiosError",
    code: "ECONNABORTED",
    config: { data: JSON.stringify({ depcom: PERSONAL_VALUE }) },
    stack: "AxiosError\n    at /srv/app/node_modules/axios/lib/core.js:1:1",
  })
}

function callbackOf(fn): Promise<{ err: any; result: any }> {
  return new Promise((resolve) => fn((err, result) => resolve({ err, result })))
}

describe("remontée des erreurs OpenFisca", () => {
  beforeEach(() => vi.clearAllMocks())

  describe("véracité de l'erreur transmise", () => {
    // Une réponse d'erreur HTTP à corps vide donne `response.data === ""`.
    // Transmise telle quelle, elle est falsy : les appelants testent `if (err)`
    // et poursuivent comme si le calcul avait abouti.
    it.each([
      ["chaîne vide", ""],
      ["zéro", 0],
      ["objet nul", null],
    ])("reste vraie quand OpenFisca répond %s", async (_libelle, data) => {
      vi.mocked(axios.post).mockRejectedValue(
        Object.assign(new Error("Request failed with status code 502"), {
          name: "AxiosError",
          code: "ERR_BAD_RESPONSE",
          response: { status: 502, data },
        }),
      )

      const { err, result } = await callbackOf((cb) =>
        sendToOpenfisca("calculate", () => ({}))({}, cb),
      )

      expect(err).toBeTruthy()
      expect(result).toBeUndefined()
    })

    it("traite une réponse 200 vide comme une erreur", async () => {
      vi.mocked(axios.post).mockResolvedValue({ status: 200, data: "" })

      const { err, result } = await callbackOf((cb) =>
        sendToOpenfisca("calculate", () => ({}))({}, cb),
      )

      expect(err).toBeTruthy()
      expect(result).toBeUndefined()
    })

    it("n'expose pas l'adresse interne du service sur une erreur réseau", async () => {
      vi.mocked(axios.post).mockRejectedValue(
        Object.assign(new Error("connect ECONNREFUSED 10.0.0.12:2000"), {
          name: "Error",
          code: "ECONNREFUSED",
        }),
      )

      const { err } = await callbackOf((cb) =>
        sendToOpenfisca("calculate", () => ({}))({}, cb),
      )

      expect(JSON.stringify(err)).not.toContain("10.0.0.12")
      expect(err.code).toBe("ECONNREFUSED")
    })

    it("conserve le message d'abandon, que le front utilise", async () => {
      vi.mocked(axios.post).mockRejectedValue(abortError())

      const { err } = await callbackOf((cb) =>
        sendToOpenfisca("calculate", () => ({}))({}, cb),
      )

      expect(err.message).toMatch(/time.?out/i)
    })

    it("ne renvoie pas la pile quand la construction de la requête échoue", async () => {
      const { err } = await callbackOf((cb) =>
        sendToOpenfisca("calculate", () => {
          throw Object.assign(new TypeError("boom"), {
            stack: "TypeError\n    at /srv/app/backend/lib/openfisca/x.ts:1:1",
          })
        })({}, cb),
      )

      expect(err).toBeTruthy()
      expect(err).not.toHaveProperty("stack")
      expect(JSON.stringify(err)).not.toContain("/srv/app")
    })
  })

  describe("sendToOpenfisca", () => {
    it("ne divulgue ni la situation personnelle ni les chemins du serveur", async () => {
      vi.mocked(axios.post).mockRejectedValue(abortError())

      const { err } = await callbackOf((cb) =>
        sendToOpenfisca("calculate", () => ({}))({}, cb),
      )

      const serialized = JSON.stringify(err)
      expect(serialized).not.toContain(PERSONAL_VALUE)
      expect(serialized).not.toContain("node_modules")
      expect(err).not.toHaveProperty("config")
      expect(err).not.toHaveProperty("stack")
      expect(err).toMatchObject({ name: "AxiosError", code: "ECONNABORTED" })
    })

    it("conserve le corps d'erreur renvoyé par OpenFisca quand il existe", async () => {
      vi.mocked(axios.post).mockRejectedValue(
        Object.assign(new Error("Bad Request"), {
          response: { data: { error: "unknown variable" } },
        }),
      )

      const { err } = await callbackOf((cb) =>
        sendToOpenfisca("calculate", () => ({}))({}, cb),
      )

      expect(err).toEqual({ error: "unknown variable" })
    })

    // Le budget par défaut vaut pour le calcul d'une situation. Le tracé d'une
    // variable sur un axe en empile 141 dans une seule requête et coûte un
    // multiple de ce temps : sans budget propre, il est abandonné en vol.
    it("budgète chaque appel selon son coût", async () => {
      vi.mocked(axios.post).mockResolvedValue({ data: {} })

      await callbackOf((cb) => sendToOpenfisca("calculate", () => ({}))({}, cb))
      expect(vi.mocked(axios.post).mock.calls[0][2]).toEqual({
        timeout: config.openfiscaTimeout,
      })

      await callbackOf((cb) =>
        sendToOpenfisca("calculate", () => ({}), {
          timeout: config.openfiscaBulkTimeout,
        })({}, cb),
      )
      expect(vi.mocked(axios.post).mock.calls[1][2]).toEqual({
        timeout: config.openfiscaBulkTimeout,
      })
      expect(config.openfiscaBulkTimeout).toBeGreaterThan(
        config.openfiscaTimeout,
      )
    })
  })

  describe("openfiscaTrace", () => {
    it("passe l'erreur à next() quand elle n'a pas de réponse HTTP", async () => {
      vi.mocked(axios.post).mockRejectedValue(abortError())

      const next = vi.fn()
      const res: any = { send: vi.fn() }
      await new Promise((resolve) => {
        simulationController.openfiscaTrace(
          { situation: {}, simulationId: "abc" } as any,
          res,
          (...args) => {
            next(...args)
            resolve(null)
          },
        )
      })

      expect(res.send).not.toHaveBeenCalled()
      expect(next).toHaveBeenCalledTimes(1)
      expect(next.mock.calls[0][0]).toMatchObject({ _id: "abc" })
    })
  })

  describe("exportRepresentation", () => {
    it("passe le rejet à next() au lieu de laisser la requête pendante", async () => {
      const failure = new Error("timeout of 25000ms exceeded")
      const next = vi.fn()
      const res: any = { json: vi.fn() }

      function FailingTeleservice() {}
      FailingTeleservice.prototype.toExternal = () => Promise.reject(failure)

      await teleservices.exportRepresentation(
        {
          teleservice: { class: FailingTeleservice },
          simulation: {},
          payload: { query: {} },
        } as any,
        res,
        next,
      )

      expect(res.json).not.toHaveBeenCalled()
      expect(next).toHaveBeenCalledWith(failure)
    })
  })
})

describe("assainissement du corps d'erreur", () => {
  beforeEach(() => vi.clearAllMocks())

  it("laisse intacte une exception applicative levée par le callback", async () => {
    vi.mocked(axios.post).mockResolvedValue({ status: 200, data: { a: 1 } })
    const bug = new TypeError("Cannot set properties of undefined")

    const received = await new Promise<any>((resolve) => {
      let first = true
      sendToOpenfisca("calculate", () => ({}))({}, (err) => {
        if (first) {
          first = false
          throw bug
        }
        resolve(err)
      })
    })

    // Le message et la pile doivent survivre : sans eux, un défaut de calcul
    // devient indébogable dans les logs comme dans Sentry.
    expect(received).toBe(bug)
    expect(received.stack).toBeTruthy()
  })

  it("ne déplie pas un corps d'erreur textuel en dictionnaire de caractères", async () => {
    vi.mocked(axios.post).mockRejectedValue(
      Object.assign(new Error("Request failed with status code 502"), {
        isAxiosError: true,
        code: "ERR_BAD_RESPONSE",
        response: { status: 502, data: "<html>502 Bad Gateway</html>" },
      }),
    )

    const { err } = await callbackOf((cb) =>
      sendToOpenfisca("calculate", () => ({}))({}, cb),
    )

    expect(err).not.toHaveProperty("0")
    expect(typeof err).toBe("object")
    expect(err.message).toBeTruthy()
  })
})

describe("routes anonymes /api/openfisca/*", () => {
  it("ne renvoie pas l'adresse interne du service via getter.get", async () => {
    const axiosGet = vi.fn().mockRejectedValue(
      Object.assign(new Error("connect ECONNREFUSED 10.0.0.12:2000"), {
        isAxiosError: true,
        code: "ECONNREFUSED",
      }),
    )
    ;(axios as any).get = axiosGet
    vi.spyOn(console, "error").mockImplementation(() => {})

    const { default: getter } = await import("@backend/lib/openfisca/getter.js")
    const callback = vi.fn()
    const err = await getter.get("/variables", callback).catch((e) => e)

    expect(callback).not.toHaveBeenCalled()
    expect(err.message).not.toContain("10.0.0.12")
    expect(err.code).toBe("ECONNREFUSED")
  })

  it("ne réécrit pas une exception levée par l'appelant", async () => {
    ;(axios as any).get = vi.fn().mockResolvedValue({ data: { a: 1 } })
    const bug = new TypeError("boom dans le handler de route")

    const { default: getter } = await import("@backend/lib/openfisca/getter.js")
    const err = await getter
      .get("/variables", () => {
        throw bug
      })
      .catch((e) => e)

    expect(err).toBe(bug)
  })
})
