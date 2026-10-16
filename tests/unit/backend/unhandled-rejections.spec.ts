import { expect, vi } from "vitest"

vi.mock("axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), defaults: {} },
}))

vi.mock("openid-client", () => ({
  discovery: vi.fn(),
  buildAuthorizationUrl: vi.fn(),
  buildEndSessionUrl: vi.fn(),
  authorizationCodeGrant: vi.fn(),
  fetchUserInfo: vi.fn(),
}))

// Le chargement du module lit le système de fichiers, ce que l'environnement
// de test ne permet pas ; seul `apply` est utilisé par le contrôleur.
vi.mock("@backend/lib/migrations/index.js", () => ({
  apply: vi.fn((simulation) => simulation),
}))

import axios from "axios"
import { discovery } from "openid-client"
import config from "@backend/config/index.js"
import { apply } from "@backend/lib/migrations/index.js"
import moncompteproController from "@backend/controllers/moncomptepro.js"
import teleservices from "@backend/controllers/teleservices/index.js"
import franceConnectRoutes from "@backend/routes/france-connect.js"
import { asyncHandler } from "@backend/lib/async-handler.js"
import DemarchesSimplifiees, {
  TeleserviceMetadataError,
} from "@backend/lib/teleservices/demarches-simplifiees.js"
import {
  formatRejection,
  registerProcessErrorHandlers,
  summarize,
} from "@backend/lib/process-error-handlers.js"

// `axios` est simulé pour le reste du fichier ; l'oracle de sérialisation, lui,
// exige la vraie classe : un objet approchant serait plus facile à résumer que
// ce qui arrive réellement en production.
const { AxiosError } = await vi.importActual<typeof import("axios")>("axios")

// Un AxiosError de production : le `ClientRequest` et l'`IncomingMessage` se
// référencent l'un l'autre. C'est cette boucle qui fait échouer la
// sérialisation du rejet une fois recopié.
function circularAxios404() {
  const request: any = { path: "/preremplir/cd53-bafa/schema" }
  const response: any = { status: 404, data: "<html>404</html>", request }
  request.res = response
  return new AxiosError(
    "Request failed with status code 404",
    AxiosError.ERR_BAD_REQUEST,
    { url: "https://www.demarches-simplifiees.fr" } as any,
    request,
    response,
  )
}

function metadataRequest() {
  return {
    simulation: { _id: "6a7680b4dce0e73de131d0e1", token: "jeton-simulation" },
    query: { procedure: "cd53-bafa" },
    protocol: "https",
    get: () => "mes-aides.exemple",
  }
}

describe("metadataResponseGenerator", () => {
  beforeEach(() => vi.clearAllMocks())

  it("passe le rejet de toInternal() à next() au lieu de laisser la requête pendante", async () => {
    const failure = new Error("téléservice injoignable")
    function FailingTeleservice() {}
    FailingTeleservice.prototype.toInternal = () => Promise.reject(failure)

    const handler = teleservices.metadataResponseGenerator({
      name: "ds",
      class: FailingTeleservice,
      destination: { label: "Aller sur le téléservice", url: "/api/proxy/ds" },
    })

    const next = vi.fn()
    const res: any = { json: vi.fn() }

    // Express 4 n'attend pas la promesse renvoyée par un gestionnaire ; on la
    // neutralise ici pour observer le gestionnaire, pas le harnais de test.
    await Promise.resolve(handler(metadataRequest() as any, res, next)).catch(
      () => undefined,
    )

    expect(res.json).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith(failure)
  })

  it("répond quand le téléservice est joignable", async () => {
    function WorkingTeleservice() {}
    WorkingTeleservice.prototype.toInternal = async () => [
      { label: "Date de naissance", value: "2001-02-03" },
    ]

    const handler = teleservices.metadataResponseGenerator({
      name: "ds",
      class: WorkingTeleservice,
      destination: { label: "Aller sur le téléservice", url: "/api/proxy/ds" },
    })

    const next = vi.fn()
    const res: any = { json: vi.fn() }

    await handler(metadataRequest() as any, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.json.mock.calls[0][0].fields).toEqual([
      { label: "Date de naissance", value: "2001-02-03" },
    ])
  })
})

describe("getMetaData", () => {
  beforeEach(() => vi.clearAllMocks())

  it("convertit un 404 du téléservice en erreur nommée et diffusable", async () => {
    vi.mocked(axios.get).mockRejectedValue(circularAxios404())

    const teleservice = new (DemarchesSimplifiees as any)(
      { answers: { current: [] }, enfants: [] },
      { procedure: "cd53-bafa" },
    )
    const error: any = await teleservice.toInternal().then(
      () => null,
      (rejection) => rejection,
    )

    expect(error).toBeInstanceOf(TeleserviceMetadataError)
    expect(error.name).toBe("TeleserviceMetadataError")
    expect(error.procedure).toBe("cd53-bafa")
    expect(error.upstreamStatus).toBe(404)
    // Statut renvoyé au client par le middleware d'erreur : la démarche visée
    // n'existe plus côté tiers, la page de consentement est inconstructible.
    expect(error.code).toBe(502)
    expect(error.message).toContain("cd53-bafa")
    expect(error.message).toContain("404")

    // pm2 recopie l'erreur avant de la diffuser au processus maître. Une copie
    // superficielle perd le `toJSON` d'axios et expose la boucle req/res : la
    // sérialisation lève, et l'erreur d'origine disparaît sans laisser de trace.
    expect(() => JSON.stringify({ ...error })).not.toThrow()
    expect(JSON.parse(JSON.stringify({ ...error }))).toMatchObject({
      name: "TeleserviceMetadataError",
      procedure: "cd53-bafa",
      upstreamStatus: 404,
      code: 502,
    })
  })

  it("laisse passer les métadonnées quand le téléservice répond", async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        revision: {
          champDescriptors: [{ id: "Q2hhbXAtMzc2NDE0", label: "Naissance" }],
        },
      },
    })

    const teleservice = new (DemarchesSimplifiees as any)(
      {
        answers: {
          current: [
            {
              id: "demandeur",
              entityName: "individu",
              fieldName: "date_naissance",
              value: "2001-02-03",
            },
          ],
        },
        enfants: [],
      },
      { procedure: "cd53-bafa" },
    )

    await expect(teleservice.toInternal()).resolves.toEqual([
      { label: "Naissance", value: "2001-02-03" },
    ])
  })
})

// `access` protège cinq groupes de routes : /api/followups/surveys,
// /api/followups/id/:surveyId, /api/followups/email/:email, /auth/redirect et
// /support. Un fournisseur d'identité injoignable y laissait la requête pendre.
describe("moncomptepro.access", () => {
  beforeEach(() => vi.clearAllMocks())

  it("redirige au lieu de rejeter quand le fournisseur d'identité est injoignable", async () => {
    const failure = new Error("only requests to HTTPS are allowed")
    vi.mocked(discovery).mockRejectedValue(failure)

    const res: any = { redirect: vi.fn(), clearCookie: vi.fn() }
    const next = vi.fn()

    const settled = await moncompteproController
      .access({ cookies: {}, query: {} } as any, res, next)
      .then(
        () => "resolue",
        () => "rejetee",
      )

    expect(settled).toBe("resolue")
    expect(res.redirect).toHaveBeenCalledWith(config.accompagnement.errorPath)
    expect(next).not.toHaveBeenCalled()
  })
})

describe("registerProcessErrorHandlers", () => {
  it("journalise un rejet non rattrapé sous une forme sérialisable", () => {
    const listeners: Record<string, ((reason: unknown) => void)[]> = {}
    const processLike: any = {
      on: (event: string, listener: (reason: unknown) => void) => {
        listeners[event] = listeners[event] || []
        listeners[event].push(listener)
      },
    }
    const logger = vi.fn()

    registerProcessErrorHandlers(processLike, logger)
    expect(listeners.unhandledRejection).toHaveLength(1)

    listeners.unhandledRejection[0](circularAxios404())

    const [label, payload] = logger.mock.calls[0]
    expect(label).toBe("unhandledRejection")
    expect(JSON.parse(payload as string)).toEqual({
      name: "AxiosError",
      message: "Request failed with status code 404",
      code: "ERR_BAD_REQUEST",
      status: 404,
      upstreamStatus: 404,
    })
  })

  // La recopie que subit l'erreur avant diffusion lui ôte le `toJSON` d'axios
  // et expose la boucle req/res : c'est ce que le résumé doit remplacer.
  it("résume une erreur que la recopie rend insérialisable", () => {
    expect(() => JSON.stringify({ ...circularAxios404() })).toThrow(
      /circular structure/i,
    )
    expect(() => JSON.parse(formatRejection(circularAxios404()))).not.toThrow()
  })

  // Une valeur fautive ne doit pas emporter les champs voisins, qui portent
  // l'essentiel du diagnostic.
  it("conserve name et message quand une autre clé est insérialisable", () => {
    const boucle: any = {}
    boucle.soi = boucle
    const resume = JSON.parse(
      formatRejection(
        Object.assign(new Error("panne amont"), {
          name: "AxiosError",
          code: boucle,
        }),
      ),
    )

    expect(resume.name).toBe("AxiosError")
    expect(resume.message).toBe("panne amont")
    expect(resume.code).toContain("non sérialisable")
  })

  it("ne relance pas un logger qui vient d'échouer", () => {
    const listeners: ((reason: unknown) => void)[] = []
    const processLike: any = {
      on: (_event: string, listener: (reason: unknown) => void) =>
        listeners.push(listener),
    }
    const logger = vi.fn(() => {
      throw new Error("stderr fermé")
    })

    registerProcessErrorHandlers(processLike, logger)

    expect(() => listeners[0](new Error("peu importe"))).not.toThrow()
    expect(logger).toHaveBeenCalledTimes(1)
  })

  it("résume un rejet qui n'est pas une erreur", () => {
    expect(summarize("boom")).toEqual({ name: "string", message: "boom" })
  })

  // Un garde-fou qui lève détruit ce qu'il existe pour préserver : le rejet
  // deviendrait une exception non rattrapée, et rien ne serait journalisé.
  describe("charges hostiles", () => {
    function messageQuiLeve() {
      const error = new Error("remplacé")
      Object.defineProperty(error, "message", {
        get() {
          throw new Error("getter explose")
        },
      })
      return error
    }

    it.each([
      ["un code BigInt", () => Object.assign(new Error("b"), { code: 1n })],
      ["un message qui lève à la lecture", messageQuiLeve],
      ["un objet sans prototype", () => Object.create(null)],
      ["un symbole", () => Symbol("boom")],
      ["undefined", () => undefined],
    ])("journalise malgré %s", (_libelle, build) => {
      const listeners: ((reason: unknown) => void)[] = []
      const processLike: any = {
        on: (_event: string, listener: (reason: unknown) => void) =>
          listeners.push(listener),
      }
      const logger = vi.fn()
      registerProcessErrorHandlers(processLike, logger)

      expect(() => listeners[0](build())).not.toThrow()
      expect(logger).toHaveBeenCalledTimes(1)
      expect(logger.mock.calls[0][0]).toBe("unhandledRejection")
      expect(typeof logger.mock.calls[0][1]).toBe("string")
      expect(logger.mock.calls[0][1]).not.toBe("")
    })

    it("conserve la valeur du code BigInt dans le résumé", () => {
      expect(
        formatRejection(Object.assign(new Error("b"), { code: 1n })),
      ).toContain('"code":"1"')
    })
  })
})

// `/api/france-connect/login` et `/logout` sont montés nus : leur rejet n'a
// personne pour le recevoir. En production `FRANCE_CONNECT_ROOT_URL` est
// absente, donc `new URL("undefined/api/v1/authorize")` lève à chaque appel et
// la requête pend jusqu'au délai du client.
describe("routes france-connect", () => {
  // Enregistre les gestionnaires montés, pour éprouver le câblage réel et non
  // le seul contrôleur.
  function mountedHandlers(path: string) {
    const routes: Record<string, any[]> = {}
    const api: any = {
      route: (p: string) => ({
        get: (...handlers: any[]) => {
          routes[p] = handlers
          return api
        },
      }),
    }
    franceConnectRoutes(api)
    return routes[path]
  }

  it.each([
    ["/france-connect/login", "/france-connect/login"],
    ["/france-connect/logout", "/france-connect/logout"],
  ])("passe à next() le jet de %s", async (_libelle, path) => {
    const handlers = mountedHandlers(path)
    const handler = handlers[handlers.length - 1]

    const next = vi.fn()
    const res: any = {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
      redirect: vi.fn(),
    }
    const req: any = { cookies: {}, query: {} }

    // Express n'attend pas la promesse renvoyée : on draine la file plutôt que
    // de dépendre de ce que le gestionnaire rend.
    handler(req, res, next)
    await new Promise((resolve) => setImmediate(resolve))

    expect(res.redirect).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledTimes(1)
    expect(next.mock.calls[0][0]).toBeInstanceOf(TypeError)
  })
})

// `/api/simulation/via/:signedPayload` est atteignable sans authentification :
// `decodePayload` décode le jeton sans en vérifier la signature, `ds` est un
// téléservice public, et `verifyRequest` n'intervient qu'après avoir chargé la
// simulation. Le `payload.id` est donc entièrement choisi par l'appelant.
describe("/api/simulation/via/:signedPayload avec un jeton non signé", () => {
  function unsignedToken(payload: object) {
    const encode = (value: object) =>
      Buffer.from(JSON.stringify(value)).toString("base64url")
    return [
      encode({ alg: "HS256", typ: "JWT" }),
      encode(payload),
      "signature-bidon",
    ].join(".")
  }

  afterEach(() => {
    vi.mocked(apply).mockImplementation((simulation) => simulation)
  })

  it("répond au lieu de retenir le socket quand la charge fait lever apply()", async () => {
    // Ce que la revue a observé en production sur un `id` objet.
    vi.mocked(apply).mockImplementation(() => {
      throw new TypeError(
        "Cannot read properties of undefined (reading 'toLowerCase')",
      )
    })

    const req: any = {}
    const res: any = { status: vi.fn().mockReturnThis(), send: vi.fn() }

    // Le jeton n'est pas signé : `decodePayload` l'accepte tout de même.
    const decoded = vi.fn()
    teleservices.decodePayload(
      req,
      res,
      decoded,
      unsignedToken({
        id: { _id: "charge-choisie-par-l-appelant" },
        scope: "ds",
      }),
    )
    expect(decoded).toHaveBeenCalledTimes(1)
    expect(req.payload.id).toEqual({ _id: "charge-choisie-par-l-appelant" })

    // `checkCredentials` laisse passer : `ds` est public.
    const authorised = vi.fn()
    teleservices.checkCredentials(req, res, authorised)
    expect(authorised).toHaveBeenCalledTimes(1)

    // `attachPayloadSituation` appelle `simulation()` sans rendre la promesse :
    // si le jet n'est pas rattrapé dedans, plus rien ne répond.
    const next = vi.fn()
    teleservices.attachPayloadSituation(req, res, next)
    await new Promise((resolve) => setImmediate(resolve))

    expect(next).toHaveBeenCalledTimes(1)
    expect(next.mock.calls[0][0]).toBeInstanceOf(TypeError)
  })
})

describe("asyncHandler", () => {
  // Un gestionnaire `param` reçoit `(req, res, next, valeur, nom)`. Une
  // enveloppe à trois arguments les lui retire en silence : ni le typage ni
  // l'exécution ne le signalent, et le paramètre devient `undefined`.
  it("propage les arguments d'un gestionnaire param", async () => {
    const handler = vi.fn(async () => undefined)
    const next = vi.fn()

    await asyncHandler(handler)(
      {} as any,
      {} as any,
      next,
      "valeur42",
      "accessToken",
    )

    expect(handler).toHaveBeenCalledWith(
      {},
      {},
      next,
      "valeur42",
      "accessToken",
    )
  })

  // Express distingue un middleware d'erreur par l'arité : 4 le convertirait
  // en gestionnaire d'erreur et le sortirait de la chaîne normale.
  it("garde une arité de 3", () => {
    expect(asyncHandler(async () => undefined).length).toBe(3)
  })

  it("rend à next() le jet synchrone d'un gestionnaire non asynchrone", async () => {
    const failure = new TypeError("Invalid URL")
    const next = vi.fn()

    await asyncHandler(() => {
      throw failure
    })({} as any, {} as any, next)

    expect(next).toHaveBeenCalledWith(failure)
  })
})

// Deux modes d'échec distincts : un résumé impossible n'est pas un journal hors
// service, et confondre les deux fait tout perdre dans le premier cas.
describe("registerProcessErrorHandlers, résumé impossible", () => {
  it("journalise un repli quand summarize lève mais que le journal est sain", () => {
    const listeners: ((reason: unknown) => void)[] = []
    const processLike: any = {
      on: (_event: string, listener: (reason: unknown) => void) =>
        listeners.push(listener),
    }
    const logger = vi.fn()
    registerProcessErrorHandlers(processLike, logger)

    // `summarize` teste `reason instanceof Error`, ce qui lève ici.
    const { proxy, revoke } = Proxy.revocable({}, {})
    revoke()

    expect(() => listeners[0](proxy)).not.toThrow()
    expect(logger).toHaveBeenCalledWith(
      "unhandledRejection",
      "<résumé impossible>",
    )
  })
})
