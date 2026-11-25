import type { CookieOptions } from "express"
import config from "../config/index.js"
import utils from "../lib/utils.js"
import {
  FranceConnectService,
  FranceConnectCookie,
} from "../lib/france-connect-service.js"

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: config.env === "production",
  sameSite: "lax",
}

export async function login(request, response) {
  const stateToken = await utils.generateToken()
  const nonceToken = await utils.generateToken()

  response.cookie(FranceConnectCookie.FcState, stateToken, cookieOptions)
  response.cookie(FranceConnectCookie.FcNonce, nonceToken, cookieOptions)

  response.redirect(
    FranceConnectService.generateLoginRedirectURL(stateToken, nonceToken),
  )
}

export async function callback(request, response, next) {
  try {
    const cookieStateToken = request.cookies[FranceConnectCookie.FcState]
    response.clearCookie(FranceConnectCookie.FcState)
    const queryStateToken = request.query.state

    if (queryStateToken !== cookieStateToken) {
      throw new Error("state is not correct")
    }

    const nonceToken = request.cookies[FranceConnectCookie.FcNonce]
    response.clearCookie(FranceConnectCookie.FcNonce)

    const { accessToken, idToken } =
      await FranceConnectService.retrieveAccessToken(
        request.query.code,
        nonceToken,
      )

    response.cookie(FranceConnectCookie.FcIdTokenHint, idToken, cookieOptions)
    response.cookie(FranceConnectCookie.FcConnected, "true", {
      ...cookieOptions,
      httpOnly: false,
    })
    request.FCToken = accessToken
    request.FCIDToken = idToken

    next()
  } catch (error) {
    console.error(error)
    response.status(503).json({ error })
  }
}

export async function fetchUserInfo(request, response) {
  try {
    const answers = await FranceConnectService.retrieveUserAnswers(
      request.FCToken,
      request.FCIDToken,
    )

    const simulation =
      await FranceConnectService.createSimulationFromAnswer(answers)

    response.json({ simulation })
  } catch (error) {
    console.error(error)
    response.status(503).json({ error })
  }
}

export async function logout(request, response) {
  const idToken = request.cookies[FranceConnectCookie.FcIdTokenHint]
  response.clearCookie(FranceConnectCookie.FcIdTokenHint)
  response.clearCookie(FranceConnectCookie.FcConnected)

  const logoutStateToken = await utils.generateToken()
  response.cookie(
    FranceConnectCookie.FcLogoutState,
    logoutStateToken,
    cookieOptions,
  )
  response.redirect(
    FranceConnectService.generateLogoutRedirectURL(idToken, logoutStateToken),
  )
}

export function logoutCallback(request, response) {
  const cookieStateToken = request.cookies[FranceConnectCookie.FcLogoutState]
  response.clearCookie(FranceConnectCookie.FcLogoutState)
  const queryStateToken = request.query.state

  if (queryStateToken !== cookieStateToken) {
    return response.redirect("/?message=Déconnection FC KO!")
  }

  response.redirect("/?message=Déconnection FC OK!")
}
