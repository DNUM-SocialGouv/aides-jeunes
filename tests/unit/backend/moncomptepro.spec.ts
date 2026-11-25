import { expect, vi } from "vitest"
import jwt from "jsonwebtoken"
import config from "../../../backend/config/index.js"
import moncompteproController from "../../../backend/controllers/moncomptepro.js"

vi.mock("openid-client", () => ({
  discovery: vi.fn(),
  buildAuthorizationUrl: () => new URL("https://proconnect.test"),
  authorizationCodeGrant: () => ({ claims: () => ({}) }),
  fetchUserInfo: () => ({ email: "user@yopmail.com" }),
}))

describe("moncomptepro access", () => {
  const res = { cookie: vi.fn(), clearCookie: vi.fn(), redirect: vi.fn() }

  it("pose un cookie httpOnly valable 8 h", async () => {
    await moncompteproController.access(
      { cookies: {}, query: { code: "code" }, originalUrl: "/" },
      res,
      vi.fn(),
    )

    const [, value, options] = res.cookie.mock.calls[0]
    const { iat, exp } = jwt.decode(value)
    expect(exp - iat).toBe(8 * 60 * 60)
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax" })
  })

  it("renvoie vers ProConnect quand le jeton a expiré", async () => {
    const expired = jwt.sign(
      { email: "user@yopmail.com", exp: 0 },
      config.sessionSecret || "secret-de-developpement-uniquement",
    )

    await moncompteproController.access(
      { cookies: { mcp_token: expired }, query: {} },
      res,
      vi.fn(),
    )

    expect(res.redirect).toHaveBeenCalledWith("https://proconnect.test/")
  })
})
