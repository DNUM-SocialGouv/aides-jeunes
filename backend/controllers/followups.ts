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
import { ErrorType, ErrorStatus, ErrorName } from "../../lib/enums/error.js"

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

export async function persist(req: Request, res: Response) {
  const { surveyOptin, email, phone } = req.body
  const simulation = req.simulation

  try {
    if (email || phone) {
      const situationResults = await simulation.compute()
      const followup = await FollowupFactory.createWithResults(
        simulation,
        surveyOptin,
        email,
        phone,
        situationResults,
      )
      if (email) await sendSimulationResultsEmail(followup, situationResults)
      if (phone) await sendSimulationResultsSms(followup)
      return res.send({ result: "OK" })
    }

    return createSimulationRecapUrl(req, res)
  } catch (error: any) {
    Sentry.captureException(error)

    let status: number = ErrorStatus.InternalServerError

    if (
      error.name === ErrorName.ValidationError ||
      error.message === ErrorType.UnsupportedPhoneNumberFormat
    ) {
      status = ErrorStatus.UnprocessableEntity
    }

    return res
      .status(status)
      .send(error.message || ErrorType.PersistingFollowup)
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

export function showSurveyResults(req: Request, res: Response) {
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
  const followup: Followup | null = await Followups.findOne({
    accessToken,
  }).populate("simulation")
  if (!followup) return res.sendStatus(ErrorStatus.NotFound)
  req.followup = followup
  next()
}

export function postSurvey(req: Request, res: Response) {
  req.followup.updateSurvey(SurveyType.BenefitAction, req.body).then(() => {
    res.sendStatus(201)
  })
  pollResult.postPollResult(req.followup, req.body)
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
