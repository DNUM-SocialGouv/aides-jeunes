import { expect, vi } from "vitest"
import jwt from "jsonwebtoken"
import * as Sentry from "@sentry/node"
import config from "../../../backend/config/index.js"
import moncompteproController, {
  JWT_EXPIRATION_DELAY,
} from "../../../backend/controllers/moncomptepro.js"

vi.mock("@sentry/node", () => ({ captureException: vi.fn() }))
vi.mock("openid-client", () => ({
  discovery: vi.fn(async () => ({})),
  buildAuthorizationUrl: vi.fn(
    () => new URL("https://proconnect.test/authorize"),
  ),
  authorizationCodeGrant: vi.fn(async () => ({
    access_token: "access-token",
    claims: () => ({ sub: "sub" }),
  })),
  fetchUserInfo: vi.fn(async () => ({ email: "user@yopmail.com" })),
  buildEndSessionUrl: vi.fn(),
}))

const sessionSecret =
  config.sessionSecret || "secret-de-developpement-uniquement"
const COOKIE_NAME = "mcp_token"
const authorizedEmail = config.moncomptepro.authorized_email_users[0]

describe("moncomptepro access", () => {
  let res, next

  beforeEach(() => {
    vi.clearAllMocks()
    res = {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
      redirect: vi.fn(),
    }
    next = vi.fn()
  })

  it("limite la durée de vie du jeton à 8 heures", () => {
    expect(JWT_EXPIRATION_DELAY).toBe(8 * 60 * 60)
  })

  it("pose un jeton de courte durée dans un cookie httpOnly après connexion", async () => {
    const req = {
      cookies: {},
      query: { code: "code" },
      originalUrl: "/api/auth/redirect?code=code",
    }

    await moncompteproController.access(req, res, next)

    expect(next).toHaveBeenCalled()
    const [name, cookieValue, options] = res.cookie.mock.calls[0]
    expect(name).toBe(COOKIE_NAME)
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      maxAge: JWT_EXPIRATION_DELAY * 1000,
    })
    const { iat, exp } = jwt.decode(cookieValue)
    expect(exp - iat).toBe(JWT_EXPIRATION_DELAY)
  })

  it("donne accès à un utilisateur autorisé déjà connecté", async () => {
    const cookieValue = jwt.sign({ email: authorizedEmail }, sessionSecret, {
      expiresIn: JWT_EXPIRATION_DELAY,
    })

    await moncompteproController.access(
      { cookies: { [COOKIE_NAME]: cookieValue }, query: {} },
      res,
      next,
    )

    expect(next).toHaveBeenCalled()
    expect(res.redirect).not.toHaveBeenCalled()
  })

  it("renvoie vers ProConnect sans erreur Sentry quand le jeton a expiré", async () => {
    const cookieValue = jwt.sign(
      {
        email: authorizedEmail,
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      sessionSecret,
    )

    await moncompteproController.access(
      { cookies: { [COOKIE_NAME]: cookieValue }, query: {} },
      res,
      next,
    )

    expect(next).not.toHaveBeenCalled()
    expect(res.clearCookie).toHaveBeenCalledWith(COOKIE_NAME)
    expect(res.redirect).toHaveBeenCalledWith(
      "https://proconnect.test/authorize",
    )
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })
})
