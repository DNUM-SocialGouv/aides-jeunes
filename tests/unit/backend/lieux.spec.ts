import { expect, vi } from "vitest"
import { Express, Request, Response } from "express"
import axios from "axios"
import registerLieuxRoutes from "../../../backend/routes/lieux.js"
import config from "../../../backend/config/index.js"

type RouteHandler = (req: Request, res: Response) => Promise<void>

type MockResponse = {
  status: (code: number) => MockResponse
  json: (data: any) => void
  statusCode?: number
}

function ccasHandler(): RouteHandler {
  let captured: RouteHandler | undefined
  const api = {
    route: () => ({
      get: (handler: RouteHandler) => {
        captured = handler
      },
    }),
  }

  registerLieuxRoutes(api as unknown as Express)

  if (!captured) {
    throw new Error("La route /lieux/ccas n'a pas été enregistrée")
  }
  return captured
}

function requestFor(codeCommune: string): Request {
  return { params: { codeCommune } } as unknown as Request
}

describe("GET /lieux/ccas/:codeCommune", () => {
  const initialToken = config.dataInclusion.token
  let handler: RouteHandler
  let res: MockResponse
  let axiosGet: any

  beforeEach(() => {
    config.dataInclusion.token = "jeton-de-test"
    handler = ccasHandler()
    res = {
      status: function (code) {
        this.statusCode = code
        return this
      },
      json: vi.fn(),
    }
    axiosGet = vi.spyOn(axios, "get").mockResolvedValue({ data: { items: [] } })
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    vi.spyOn(console, "error").mockImplementation(() => undefined)
  })

  afterEach(() => {
    config.dataInclusion.token = initialToken
    vi.restoreAllMocks()
  })

  it("interroge data.inclusion et relaie la réponse", async () => {
    axiosGet.mockResolvedValue({ data: { items: [{ id: "ccas-1" }] } })

    await handler(requestFor("75056"), res as unknown as Response)

    expect(axiosGet).toHaveBeenCalledWith(
      `${config.dataInclusion.url}/structures`,
      {
        params: {
          sources: "ma-boussole-aidants",
          reseaux_porteurs: "ccas-cias",
          code_commune: "75056",
        },
        headers: { Authorization: "Bearer jeton-de-test" },
      },
    )
    expect(res.json).toHaveBeenCalledWith({ items: [{ id: "ccas-1" }] })
  })

  it("garde le code commune dans un seul paramètre malgré une tentative d'injection", async () => {
    const injection = "75056&reseaux_porteurs=tous&sources=n-importe-quoi"

    await handler(requestFor(injection), res as unknown as Response)

    const [url, requestConfig] = axiosGet.mock.calls[0]
    expect(url).toBe(`${config.dataInclusion.url}/structures`)
    expect(requestConfig.params.code_commune).toBe(injection)
    expect(requestConfig.params.reseaux_porteurs).toBe("ccas-cias")
    expect(requestConfig.params.sources).toBe("ma-boussole-aidants")
  })

  it("échappe les séparateurs de query une fois la requête sérialisée", async () => {
    await handler(
      requestFor("75056&reseaux_porteurs=tous"),
      res as unknown as Response,
    )

    const [, requestConfig] = axiosGet.mock.calls[0]
    const query = new URLSearchParams(requestConfig.params).toString()

    expect(query).toContain("code_commune=75056%26reseaux_porteurs%3Dtous")
    expect(query.match(/(^|&)reseaux_porteurs=/g)).toHaveLength(1)
  })

  it("préserve un code commune corse sans le dénaturer", async () => {
    await handler(requestFor("2A004"), res as unknown as Response)

    const [, requestConfig] = axiosGet.mock.calls[0]
    expect(requestConfig.params.code_commune).toBe("2A004")
  })

  it("répond 503 sans appeler data.inclusion quand le jeton est absent", async () => {
    config.dataInclusion.token = ""

    await handler(requestFor("75056"), res as unknown as Response)

    expect(res.statusCode).toBe(503)
    expect(axiosGet).not.toHaveBeenCalled()
  })

  it("répond 500 quand data.inclusion est en erreur", async () => {
    axiosGet.mockRejectedValue(new Error("data.inclusion indisponible"))

    await handler(requestFor("75056"), res as unknown as Response)

    expect(res.statusCode).toBe(500)
  })
})
