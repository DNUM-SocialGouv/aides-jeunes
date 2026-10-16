import { expect, vi } from "vitest"

// Le chargement du module lit le système de fichiers, ce que l'environnement
// de test ne permet pas ; seul `apply` est utilisé par le contrôleur.
vi.mock("@backend/lib/migrations/index.js", () => ({
  apply: (simulation) => simulation,
}))

vi.mock("@backend/lib/followup-factory.js", () => ({
  FollowupFactory: { create: vi.fn(), createWithResults: vi.fn() },
}))

vi.mock("@backend/lib/messaging/email/email-service.js", () => ({
  sendSimulationResultsEmail: vi.fn(),
}))

// Seul l'envoi est simulé : `SmsProviderError` reste la vraie classe, pour que
// les cas ci-dessous rejettent l'objet que le service produit réellement.
vi.mock(
  "@backend/lib/messaging/sms/sms-service.js",
  async (importOriginal) => ({
    ...((await importOriginal()) as object),
    sendSimulationResultsSms: vi.fn(),
  }),
)

vi.mock("@backend/lib/mattermost-bot/poll-result.js", () => ({
  default: { postPollResult: vi.fn() },
}))

vi.mock("@sentry/node", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  setupExpressErrorHandler: vi.fn(),
}))

import * as Sentry from "@sentry/node"
import pollResult from "@backend/lib/mattermost-bot/poll-result.js"
import { persist, postSurvey } from "@backend/controllers/followups.js"
import { FollowupFactory } from "@backend/lib/followup-factory.js"
import { sendSimulationResultsEmail } from "@backend/lib/messaging/email/email-service.js"
import {
  sendSimulationResultsSms,
  SmsProviderError,
} from "@backend/lib/messaging/sms/sms-service.js"

const SIMULATION_ID = "6a76a643e1ed9101a793e122"

// Corps que le fournisseur renvoie sous un HTTP 200 pour refuser le numéro ;
// l'intercepteur de `sms-service` le transforme en `SmsProviderError`.
const PROVIDER_REJECTION_BODY = {
  responseCode: 3,
  responseMessage: "Invalid destination address",
}

function mockResponse() {
  const res: any = { statusCode: undefined, body: undefined }
  res.status = vi.fn((code) => {
    res.statusCode = code
    return res
  })
  res.send = vi.fn((body) => {
    res.body = body
    return res
  })
  return res
}

function request(body) {
  return {
    body,
    simulation: { _id: SIMULATION_ID },
  } as any
}

describe("persist", () => {
  let consoleSpy

  beforeEach(() => {
    vi.clearAllMocks()
    consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.mocked(FollowupFactory.createWithResults).mockResolvedValue({} as any)
    vi.mocked(sendSimulationResultsEmail).mockResolvedValue({} as any)
    vi.mocked(sendSimulationResultsSms).mockResolvedValue({} as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("répond 200 quand les deux envois aboutissent", async () => {
    const res = mockResponse()

    await persist(
      request({ email: "usager@exemple.fr", phone: "0600000000" }),
      res,
    )

    expect(res.status).not.toHaveBeenCalled()
    expect(res.send).toHaveBeenCalledWith({ result: "OK" })
  })

  describe("refus du numéro par le fournisseur de SMS", () => {
    beforeEach(() => {
      vi.mocked(sendSimulationResultsSms).mockRejectedValue(
        new SmsProviderError(PROVIDER_REJECTION_BODY, 200),
      )
    })

    // Un numéro au bon format mais non joignable est une entrée irrecevable :
    // l'usager qui réessaie obtient le même refus, indéfiniment.
    it("répond 422 et non 500", async () => {
      const res = mockResponse()

      await persist(request({ phone: "0600000000" }), res)

      expect(res.status).toHaveBeenCalledWith(422)
    })

    // `sms-service` exclut délibérément ce refus de Sentry ; le signaler ici
    // annulerait cette exclusion.
    it("ne le signale pas à Sentry", async () => {
      await persist(request({ phone: "0600000000" }), mockResponse())

      expect(Sentry.captureException).not.toHaveBeenCalled()
    })

    // Sans table de correspondance des codes du fournisseur, `responseCode` ne
    // sert pas encore à classer ; le journaliser rend observables ceux qui
    // arrivent réellement, seule voie vers une classification exacte.
    it("journalise le code de refus du fournisseur", async () => {
      await persist(request({ phone: "0600000000" }), mockResponse())

      const logged = consoleSpy.mock.calls
        .map((call) => call.map(String).join(" "))
        .join("\n")

      expect(logged).toContain('"responseCode":3')
      expect(logged).toContain("422")
    })

    // Le formulaire de récapitulatif distingue ce cas sur le corps de la
    // réponse pour afficher un message dédié.
    it("conserve le libellé du fournisseur dans le corps", async () => {
      const res = mockResponse()

      await persist(request({ phone: "0600000000" }), res)

      expect(res.body).toContain("Invalid destination address")
    })
  })

  describe("panne réelle", () => {
    const openfiscaFailure = Object.assign(
      new Error("Request failed with status code 502"),
      {
        name: "AxiosError",
        code: "ERR_BAD_RESPONSE",
        response: { status: 502 },
      },
    )

    beforeEach(() => {
      vi.mocked(FollowupFactory.createWithResults).mockRejectedValue(
        openfiscaFailure,
      )
    })

    it("répond 500 et le signale à Sentry", async () => {
      const res = mockResponse()

      await persist(request({ email: "usager@exemple.fr" }), res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(Sentry.captureException).toHaveBeenCalledWith(openfiscaFailure)
    })

    // Sans trace applicative, un 500 sur cette route ne laisse dans les
    // journaux du serveur que la ligne d'accès : le statut, jamais la cause.
    it("journalise la route, la simulation et la cause", async () => {
      await persist(request({ email: "usager@exemple.fr" }), mockResponse())

      const logged = consoleSpy.mock.calls
        .map((call) => call.map(String).join(" "))
        .join("\n")

      expect(logged).toContain(`/api/simulation/${SIMULATION_ID}/followup`)
      expect(logged).toContain("500")
      expect(logged).toContain("AxiosError")
      expect(logged).toContain("ERR_BAD_RESPONSE")
      expect(logged).toContain("Request failed with status code 502")
      expect(logged).toContain('"upstreamStatus":502')
      expect(logged).toContain('"channels":{"email":true,"phone":false}')
    })
  })

  describe("erreur de validation du modèle", () => {
    const validationError = Object.assign(
      new Error("Followup validation failed: email"),
      { name: "ValidationError" },
    )

    beforeEach(() => {
      vi.mocked(FollowupFactory.createWithResults).mockRejectedValue(
        validationError,
      )
    })

    it("répond 422", async () => {
      const res = mockResponse()

      await persist(request({ email: "pas-une-adresse" }), res)

      expect(res.status).toHaveBeenCalledWith(422)
    })

    // Une `ValidationError` peut trahir un défaut de code, pas seulement une
    // saisie : la taire priverait Sentry du seul signal disponible.
    it("reste signalée à Sentry", async () => {
      await persist(request({ email: "pas-une-adresse" }), mockResponse())

      expect(Sentry.captureException).toHaveBeenCalledWith(validationError)
    })
  })

  // Chemin « obtenir un lien de récapitulatif » : POST sans courriel ni
  // téléphone. `createSimulationRecapUrl` étant asynchrone, son rejet doit
  // atteindre le `catch` de `persist` au lieu de le contourner.
  describe("lien de récapitulatif", () => {
    it("répond au lieu de rejeter quand la création du followup échoue", async () => {
      const failure = new Error("MongoNetworkError: connexion perdue")
      vi.mocked(FollowupFactory.create).mockRejectedValue(failure)
      const res = mockResponse()

      const settled = await persist(request({ surveyOptin: false }), res).then(
        () => "resolue",
        () => "rejetee",
      )

      expect(settled).toBe("resolue")
      expect(res.status).toHaveBeenCalledWith(500)
      expect(Sentry.captureException).toHaveBeenCalledWith(failure)
    })
  })

  it("répond 422 sur un format de numéro refusé en amont", async () => {
    vi.mocked(sendSimulationResultsSms).mockRejectedValue(
      new Error("Unsupported phone number format"),
    )
    const res = mockResponse()

    await persist(request({ phone: "12" }), res)

    expect(res.status).toHaveBeenCalledWith(422)
  })
})

// La notification Mattermost part sans être attendue : depuis que
// `Mattermost.post` propage ses échecs, son rejet doit être rattrapé sur place,
// sous peine de redevenir un `unhandledRejection`.
describe("postSurvey", () => {
  it("rattrape l'échec de la notification sans faire échouer la requête", async () => {
    vi.clearAllMocks()
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined)
    const failure = new Error("connect ECONNREFUSED")
    vi.mocked(pollResult.postPollResult).mockRejectedValue(failure)

    const res: any = { sendStatus: vi.fn() }
    const req: any = {
      followup: { updateSurvey: vi.fn().mockResolvedValue(undefined) },
      body: [{ id: "aide", value: "asked" }],
    }

    postSurvey(req, res, vi.fn())
    await new Promise((resolve) => setImmediate(resolve))

    expect(res.sendStatus).toHaveBeenCalledWith(201)
    expect(Sentry.captureException).toHaveBeenCalledWith(failure)
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
