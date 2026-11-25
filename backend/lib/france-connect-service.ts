import axios from "axios"
import jwt from "jsonwebtoken"
import config from "../config/index.js"
import { Answer } from "../../lib/types/answer.d.js"

export const enum FranceConnectCookie {
  FcState = "fc_state",
  FcNonce = "fc_nonce",
  FcIdTokenHint = "fc_id_token_hint",
  FcLogoutState = "fc_logout_state",
}

const FranceConnectConfig = config.franceConnect

function generateLoginRedirectURL(stateToken, nonceToken) {
  const baseURL = config.baseURL
  const callbackURL = `${baseURL}/callback`

  const url = new URL(`${FranceConnectConfig.root}/api/v1/authorize`)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", FranceConnectConfig.clientId as string)
  url.searchParams.set("redirect_uri", callbackURL)
  url.searchParams.set("scope", FranceConnectConfig.scopes)
  url.searchParams.set("state", stateToken)
  url.searchParams.set("nonce", nonceToken)

  return url.toString()
}

async function retrieveAccessToken(code, nonceToken) {
  const tokenEndpoint = `${FranceConnectConfig.root}/api/v1/token`
  const callbackURL = `${config.baseURL}/callback`

  const data = {
    grant_type: "authorization_code",
    redirect_uri: callbackURL,
    client_id: FranceConnectConfig.clientId,
    client_secret: FranceConnectConfig.clientSecret,
    code,
  }

  const headers = {
    "Content-Type": "application/json",
  }

  const response = await axios.post(tokenEndpoint, data, { headers })

  const decoded = jwt.verify(
    response.data.id_token,
    FranceConnectConfig.clientSecret,
  )

  if (decoded.nonce !== nonceToken) {
    throw new Error("nonce is not correct")
  }

  return {
    accessToken: response.data.access_token,
    idToken: response.data.id_token,
  }
}

async function retrieveUserAnswers(accessToken, idToken) {
  const answers: Answer[] = []
  const headers = {
    Authorization: `Bearer ${accessToken}`,
  }

  const userInfoEndpoint = `${FranceConnectConfig.root}/api/v1/userinfo?schema=openid`
  const userResponse = await axios.get(userInfoEndpoint, { headers })

  answers.push({
    entityName: "franceconnect",
    fieldName: "userinfo",
    value: userResponse.data,
  })

  answers.push({
    entityName: "franceconnect",
    fieldName: "idtoken",
    value: idToken,
  })

  answers.push({
    entityName: "individu",
    id: "demandeur",
    fieldName: "date_naissance",
    value: userResponse.data.birthdate,
  })

  try {
    const mesriResponse = await axios.get(
      FranceConnectConfig.mesriEndpoint as string,
      { headers },
    )

    answers.push({
      entityName: "franceconnect",
      fieldName: "mesri",
      value: mesriResponse.data,
    })
  } catch (error: any) {
    console.error("Error while fetching MESRI data", error.message)
  }

  return answers
}

async function createSimulationFromAnswer(answers) {
  const simulation = await axios.post(
    `${process.env.MES_AIDES_ROOT_URL}/api/simulation`,
    {
      dateDeValeur: new Date(),
      answers: {
        all: answers,
        current: [],
      },
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  )

  return simulation.data
}

function generateLogoutRedirectURL(
  idToken: string,
  logoutStateToken: string,
): string {
  const baseURL = config.baseURL
  const logoutCallbackURL = `${baseURL}/logout-callback`

  const url = new URL(`${FranceConnectConfig.root}/api/v1/logout`)
  url.searchParams.set("id_token_hint", idToken)
  url.searchParams.set("state", logoutStateToken)
  url.searchParams.set("post_logout_redirect_uri", logoutCallbackURL)

  return url.toString()
}

export const FranceConnectService = {
  generateLoginRedirectURL,
  retrieveAccessToken,
  retrieveUserAnswers,
  createSimulationFromAnswer,
  generateLogoutRedirectURL,
}
