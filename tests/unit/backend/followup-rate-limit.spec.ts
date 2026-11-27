// @vitest-environment node
import express from "express"
import { AddressInfo } from "net"
import { vi } from "vitest"
import simulationRoutes from "../../../backend/routes/simulation.js"

const { pass } = vi.hoisted(() => ({ pass: (req, res, next) => next() }))

vi.mock("../../../backend/controllers/followups.js", () => ({
  persist: (req, res) => res.send({ result: "OK" }),
}))
vi.mock("../../../backend/controllers/simulation.js", () => ({
  default: new Proxy({}, { get: () => pass }),
}))
vi.mock("../../../backend/controllers/simulation-demo.js", () => ({
  default: { get: pass },
}))
vi.mock("../../../backend/controllers/teleservices/index.js", () => ({
  default: new Proxy({}, { get: (_, key) => (key === "names" ? [] : pass) }),
}))

describe("POST /simulation/:id/followup rate limit", () => {
  let server
  let baseUrl

  beforeAll(() => {
    const app = express()
    simulationRoutes(app)
    server = app.listen(0)
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`
  })

  afterAll(() => server.close())

  const post = (simulationId, body) =>
    fetch(`${baseUrl}/simulation/${simulationId}/followup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

  it("refuse le 6e envoi sur la même simulation", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await post("sim-1", { email: "a@yopmail.com" })).status).toBe(200)
    }
    expect((await post("sim-1", { email: "a@yopmail.com" })).status).toBe(429)
    expect((await post("sim-2", { email: "a@yopmail.com" })).status).toBe(200)
  })

  it("ne compte pas les appels sans email ni téléphone", async () => {
    for (let i = 0; i < 10; i++) {
      expect((await post("sim-3", { surveyOptin: true })).status).toBe(200)
    }
    expect((await post("sim-3", { phone: "0600000000" })).status).toBe(200)
  })
})
