import { Response, NextFunction } from "express"
import * as Sentry from "@sentry/node"

import Followups from "../models/followup.js"
import { Followup } from "../../lib/types/followup.d.js"
import Benefits from "../../data/all.js"
import pollResult from "../lib/mattermost-bot/poll-result.js"
import simulationController from "./simulation.js"
import { SurveyType } from "../../lib/enums/survey.js"
import { FollowupFactory } from "../lib/followup-factory.js"
import { FetchSurvey } from "../../lib/types/survey.d.js"
import Request from "../types/express.d.js"
import config from "../config/index.js"
import { sendSimulationResultsEmail } from "../lib/messaging/email/email-service.js"
import { sendSimulationResultsSms } from "../lib/messaging/sms/sms-service.js"
import {
  ErrorType,
  ErrorStatus,
  isRejectedDestination,
  isUserInputError,
} from "../../lib/enums/error.js"

export async function followup(
  req: Request,
  res: Response,
  next: NextFunction,
  id: string,
) {
  try {
    const followup = await Followups.findById(id).populate("simulation").exec()

    if (!followup?.accessToken || followup.accessToken !== req?.query?.token) {
      return res.redirect("/")
    }

    req.followup = followup
    simulationController.simulation(req, res, next, followup.simulation)
  } catch (err) {
    return next(err)
  }
}

async function createSimulationRecapUrl(req: Request, res: Response) {
  const followup = await FollowupFactory.create(req.simulation)
  await followup.addSurveyIfMissing(
    SurveyType.TrackClickTemporarySimulationLink,
  )
  await followup.save()
  const simulationRecapUrl = `${config.baseURL}${followup.shortRecapPath}`
  return res.send({ simulationRecapUrl })
}

// Le message d'un `SmsProviderError` porte la réponse entière du fournisseur :
// un contenu décidé par un tiers, de longueur non bornée, versé dans nos
// journaux. `responseCode` en donne l'essentiel ; le reste est écourté.
const LOGGED_MESSAGE_MAX = 300

function forLog(message: unknown): unknown {
  if (typeof message !== "string" || message.length <= LOGGED_MESSAGE_MAX) {
    return message
  }
  return `${message.slice(0, LOGGED_MESSAGE_MAX)}… (${message.length} caractères)`
}

export async function persist(req: Request, res: Response) {
  const { surveyOptin, email, phone } = req.body
  const simulation = req.simulation

  try {
    if (email || phone) {
      const followup = await FollowupFactory.createWithResults(
        simulation,
        surveyOptin,
        email,
        phone,
      )
      if (email) await sendSimulationResultsEmail(followup)
      if (phone) await sendSimulationResultsSms(followup)
      return res.send({ result: "OK" })
    }

    // `return await` et non `return` : dans une fonction asynchrone, la promesse
    // renvoyée est résolue hors du `try`, et son rejet échapperait au `catch`.
    return await createSimulationRecapUrl(req, res)
  } catch (error: any) {
    const userInputError = isUserInputError(error)
    const status: number = userInputError
      ? ErrorStatus.UnprocessableEntity
      : ErrorStatus.InternalServerError

    // Sans cette trace, la seule empreinte d'un échec ici est la ligne d'accès
    // du serveur : le statut, jamais la cause.
    console.error(
      `POST /api/simulation/${simulation?._id}/followup → ${status}`,
      JSON.stringify({
        name: error?.name,
        message: forLog(error?.message),
        code: error?.code,
        // Rend observables les codes de refus du fournisseur de SMS : sans
        // table de correspondance, seuls ceux constatés ici pourront un jour
        // être classés autrement que par le libellé.
        responseCode: error?.responseCode,
        upstreamStatus: error?.response?.status ?? error?.httpStatus,
        channels: { email: Boolean(email), phone: Boolean(phone) },
      }),
      error?.stack,
    )

    // `sms-service` exclut délibérément ce refus de Sentry ; le signaler ici
    // annulerait cette exclusion. Les autres 422 — validation du modèle — y
    // restent : ils peuvent trahir un défaut de code, pas seulement une saisie.
    if (!isRejectedDestination(error)) {
      Sentry.captureException(error)
    }

    return res
      .status(status)
      .send(error?.message || ErrorType.PersistingFollowup)
  }
}

export function getFollowupDataForSurvey(req: Request, res: Response) {
  const usefullnessSurvey = req.followup.surveys.find(
    (survey) =>
      survey.type === SurveyType.TrackClickOnSimulationUsefulnessEmail,
  )

  const simulationWasUseful =
    usefullnessSurvey?.answers.find((answer) => answer.id === "wasUseful")
      ?.value ?? true // La simulation est utile par défaut

  const depcomAnswer = req.followup.simulation?.answers?.all?.find(
    (answer) => answer.entityName === "menage" && answer.fieldName === "depcom",
  )
  const simulationCommune = depcomAnswer?.value._nomCommune || ""

  res.send({
    createdAt: req.followup.createdAt,
    benefits: req.followup.benefits.filter(
      (benefit) => benefit.id in Benefits.benefitsMap,
    ),
    simulationWasUseful,
    simulationCommune,
  } as FetchSurvey)
}

export function showFollowup(req: Request, res: Response) {
  Followups.findById(req.params.surveyId)
    .then((followup: Followup | null) => {
      if (!followup) return res.sendStatus(404)
      res.send([followup])
    })
    .catch((error: Error) => {
      console.error("error", error)
      return res.sendStatus(ErrorStatus.BadRequest)
    })
}

export function showSurveyResults(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  Followups.find({
    surveyOptin: true,
    surveys: {
      $elemMatch: {
        repliedAt: { $exists: true },
        type: SurveyType.BenefitAction,
      },
    },
  })
    .skip(0)
    .limit(10)
    .sort({ "surveys.repliedAt": -1 })
    .then((followup: Followup[]) => {
      res.send(followup)
    })
    .catch(next)
}

export function showSurveyResultByEmail(req: Request, res: Response) {
  Followups.findByEmail(req.params.email)
    .then((followups: Followup[]) => {
      if (!followups || !followups.length)
        return res.sendStatus(ErrorStatus.NotFound)
      res.send(followups)
    })
    .catch((error: Error) => {
      console.error("error", error)
      return res.sendStatus(ErrorStatus.BadRequest)
    })
}

export async function followupByAccessToken(
  req: Request,
  res: Response,
  next: NextFunction,
  accessToken: any,
) {
  try {
    const followup: Followup | null = await Followups.findOne({
      accessToken,
    }).populate("simulation")
    if (!followup) return res.sendStatus(ErrorStatus.NotFound)
    req.followup = followup
    next()
  } catch (error) {
    next(error)
  }
}

export function postSurvey(req: Request, res: Response, next: NextFunction) {
  req.followup
    .updateSurvey(SurveyType.BenefitAction, req.body)
    .then(() => {
      res.sendStatus(201)
    })
    .catch(next)
  // La notification Mattermost est accessoire : la réponse de l'usager est déjà
  // enregistrée et le 201 déjà émis. Elle ne doit ni faire échouer la requête,
  // ni disparaître si Mattermost est injoignable.
  pollResult.postPollResult(req.followup, req.body).catch((error) => {
    console.error("Échec de la notification Mattermost du sondage", error)
    Sentry.captureException(error)
  })
}

export async function updateWasUseful(req: Request) {
  const answers = [
    {
      id: "wasUseful",
      value: req.query.wasuseful !== undefined,
    },
  ]
  const { followup } = req
  await followup.updateSurvey(
    SurveyType.TrackClickOnSimulationUsefulnessEmail,
    answers,
  )
}

async function updateSurveyInFollowup(req: Request) {
  const { surveyType } = req.params
  const { followup } = req

  switch (surveyType) {
    case SurveyType.TrackClickOnSimulationUsefulnessEmail:
      await updateWasUseful(req)
      break
    default:
      await followup.updateSurvey(surveyType)
      break
  }
}

async function getRedirectUrl(req: Request) {
  const { surveyType } = req.params
  const { followup } = req
  switch (surveyType) {
    case SurveyType.TrackClickOnSimulationUsefulnessEmail:
    case SurveyType.TrackClickOnBenefitActionSms: {
      await followup.addSurveyIfMissing(SurveyType.BenefitAction)
      await followup.save()
      return followup.surveyPath
    }
    case SurveyType.TrackClickTemporarySimulationLink:
      await followup.save()
      return followup.recapPath
    case SurveyType.TousABordNotification:
      return "https://www.tadao.fr/713-Demandeur-d-emploi.html"
    default:
      throw new Error(`${ErrorType.UnknownSurveyType} : ${surveyType}`)
  }
}

export async function logSurveyLinkClick(req: Request, res: Response) {
  try {
    await updateSurveyInFollowup(req)
    const redirectUrl = await getRedirectUrl(req)
    res.redirect(redirectUrl)
  } catch (error) {
    console.error("Error: survey update in followup", error)
    return res.sendStatus(ErrorStatus.NotFound)
  }
}
