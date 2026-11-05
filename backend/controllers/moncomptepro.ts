import jwt from "jsonwebtoken"
import config from "../config/index.js"
import * as client from "openid-client"
import * as Sentry from "@sentry/node"

const JWT_EXPIRATION_DELAY = 15552000 // 6 * 30 * 24 * 60 * 60 = 6 months
const MCP_TOKEN = "mcp_token"
const MCP_CODE_VERIFER = "mcp_vrfer"

const accompagnement = config.accompagnement

const {
  authorized_email_users,
  client_id,
  client_secret,
  provider,
  redirect_uri,
  scope,
} = config.moncomptepro

const { sessionSecret } = config
const baseUrl = config.baseURL

const getMcpClient = async (): Promise<client.Configuration> => {
  return await client.discovery(new URL(provider), client_id, client_secret)
}

const login = async (req, res) => {
  const mcpIssuer = await getMcpClient()
  const parameters: Record<string, string> = {
    redirect_uri,
    scope,
  }
  const redirectUrl: URL = client.buildAuthorizationUrl(mcpIssuer, parameters)
  return res.redirect(redirectUrl.href)
}

const retrieveMcpAccessToken = async (req) => {
  try {
    const mcpIssuer = await getMcpClient()
    const currentUrl = new URL(config.baseURL + req.originalUrl)
    return await client.authorizationCodeGrant(mcpIssuer, currentUrl, {})
  } catch (error) {
    console.error("Error in retrieveMcpAccessToken: ", error)
    throw error
  }
}

const access = async (req, res, next) => {
  try {
    const { cookies } = req
    let mcpToken = cookies && cookies[MCP_TOKEN]
    const mcpCode = req.query.code

    if (mcpCode) {
      const tokens = await retrieveMcpAccessToken(req)
      const mcpIssuer = await getMcpClient()
      if (!tokens) {
        throw new Error("No mcpAccessToken")
      }

      const { access_token } = tokens
      const claims = tokens.claims()!
      const { sub } = claims
      const userInfo = await client.fetchUserInfo(mcpIssuer, access_token, sub)
      if (!userInfo.email) {
        throw new Error("No userInfo email")
      }
      const isAuthorized = authorized_email_users.includes(userInfo.email)

      if (isAuthorized) {
        mcpToken = jwt.sign({ email: userInfo.email }, sessionSecret, {
          expiresIn: JWT_EXPIRATION_DELAY,
        })
        res.cookie(MCP_TOKEN, mcpToken)
      } else {
        clearCookie(res)
        return res.redirect(accompagnement.unauthorizedPath)
      }
    }

    if (mcpToken) {
      const userInfo = jwt.verify(mcpToken, sessionSecret)
      const isAuthorized = authorized_email_users.includes(userInfo.email)

      if (isAuthorized) {
        return next()
      } else {
        clearCookie(res)
        return res.redirect(accompagnement.unauthorizedPath)
      }
    }

    // `return await` et non `return` : dans une fonction asynchrone, la promesse
    // renvoyée est résolue hors du `try`, et son rejet échapperait au `catch`.
    return await login(req, res)
  } catch (error) {
    Sentry.captureException(error)
    clearCookie(res)
    return res.redirect(accompagnement.errorPath)
  }
}

const loginCallbackRedirect = (req, res) => {
  if (req.query.code) {
    res.redirect(accompagnement.path)
  } else {
    return res.redirect("/")
  }
}

const clearCookie = (res) => {
  res.clearCookie(MCP_TOKEN)
  res.clearCookie(MCP_CODE_VERIFER)
}

const logout = async (req, res, next) => {
  try {
    clearCookie(res)
    const mcpIssuer = await getMcpClient()
    const redirectUrl = client.buildEndSessionUrl(mcpIssuer, {
      post_logout_redirect_uri: `${baseUrl}${accompagnement.path}`,
    }).href
    res.redirect(redirectUrl)
  } catch (e) {
    next(e)
  }
}

export default { access, login, loginCallbackRedirect, logout }
