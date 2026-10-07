import { omit, filter, pick, assign } from "lodash-es"

import config from "../config/index.js"
import { generateSituation } from "../../lib/situations.js"
import openfisca from "../lib/openfisca/index.js"
import openfiscaTestLib from "../lib/openfisca/test.js"
import { apply } from "../lib/migrations/index.js"

import Simulations from "../models/simulation.js"
import Followups from "../models/followup.js"
import { Followup } from "../../lib/types/followup.d.js"
import { Simulation } from "../../lib/types/simulation.d.js"
import allBenefits from "../../data/all.js"
import Request from "../types/express.d.js"
import * as Sentry from "@sentry/node"

function setSimulationOnRequest(req: Request, simulation: Simulation) {
  req.simulation = apply(simulation)
  req.situation = generateSituation(req.simulation)
}

async function simulation(
  req: Request,
  res,
  next,
  simulationOrSimulationId: Simulation | Simulation["_id"] | string,
) {
  if (
    simulationOrSimulationId &&
    typeof simulationOrSimulationId === "object" &&
    "_id" in simulationOrSimulationId
  ) {
    const simulation = simulationOrSimulationId as Simulation
    setSimulationOnRequest(req, simulation)
    return next()
  }

  try {
    const simulation = await Simulations.findById(simulationOrSimulationId)

    if (!simulation) {
      return res.sendStatus(404)
    }

    setSimulationOnRequest(req, simulation)
    next()
  } catch (err) {
    next(err)
  }
}

function attachAccessCookie(req: Request, res, next?) {
  const cookiesParameters = {
    maxAge: 604800000, // Duration: 7 days in milliseconds
    sameSite: config.baseURL.startsWith("https") ? "none" : "lax",
    secure: config.baseURL.startsWith("https"),
  }
  res.cookie(
    req.simulation?.cookieName,
    req.simulation?.token,
    cookiesParameters,
  )
  res.cookie(
    "lastestSimulation",
    req.simulation?._id?.toString(),
    cookiesParameters,
  )
  next()
}

function validateAccess(req: Request, res, next) {
  if (
    req.simulation?.isAccessible({
      ...req.cookies,
      ...req.query,
      ...req.headers,
    })
  )
    return next()
  res.status(403).send({ error: "You do not have access to this situation." })
}

function show(req: Request, res) {
  res.send(req.simulation)
}

function clearCookies(req: Request, res) {
  const limit = 10

  const keys = Object.keys(req.cookies)
  const situationCookies = filter(keys, function (k) {
    return k.startsWith(Simulations.cookiePrefix())
  })
  situationCookies.sort()

  if (situationCookies.length - limit >= 0) {
    const cookieToClear = situationCookies.slice(
      0,
      situationCookies.length - limit,
    )
    cookieToClear.forEach(function (name) {
      res.clearCookie(name, { httpOnly: true })
    })
  }
}

async function create(req: Request, res, next) {
  if (req.body._id) {
    return res.status(403).send({
      error:
        "You can't provide _id when saving a situation. _id will be generated automatically.",
    })
  }

  try {
    const persistedSimulation = await Simulations.create(
      omit(req.body, "createdAt", "status", "token"),
    )

    clearCookies(req, res)
    req.simulation = persistedSimulation
    next()
  } catch (err) {
    next(err)
  }
}

function openfiscaResponse(req: Request, res, next) {
  return openfisca.calculate(req.situation, function (err, result) {
    if (err)
      return next(
        Object.assign(err.response?.data || err, {
          _id: req.simulationId,
        }),
      )

    res.send(Object.assign(result, { _id: req.simulationId }))
  })
}

function results(req: Request, res, next) {
  return req.simulation
    .compute()
    .then((results) => {
      return res.send(Object.assign(results, { _id: req.simulation?._id }))
    })
    .catch((err) => {
      return next(
        Object.assign(err?.response?.data || err, {
          _id: req.simulation?._id,
        }),
      )
    })
}

function openfiscaTrace(req: Request, res, next) {
  return openfisca.trace(req.situation, function (err, result) {
    if (err)
      return next(
        Object.assign(err?.response?.data || err, {
          _id: req.simulationId,
        }),
      )

    res.send(Object.assign(result, { _id: req.simulationId }))
  })
}

function openfiscaRequest(req: Request, res) {
  res.send(openfisca.buildOpenFiscaRequest(req.situation))
}

const DETAILS_DEFAULT_ATTRIBUTES = {
  absolute_error_margin: 10,
}

// Attributes are sorted as they should appear in the YAML test file
const DETAILS_ATTRIBUTES = [
  "name",
  "description",
  "extension",
  "absolute_error_margin",
  "relative_error_margin",
  "output",
]

function openfiscaTest(req: Request, res) {
  const details = assign(
    {},
    DETAILS_DEFAULT_ATTRIBUTES,
    pick(req.body, DETAILS_ATTRIBUTES),
  )
  if (!details.name || !details.description || !details.output) {
    return res
      .status(403)
      .send({ error: "You must provide a name, description and output." })
  }

  const situation = req.situation.toObject
    ? req.situation.toObject()
    : req.situation
  res.type("yaml").send(openfiscaTestLib.generateYAMLTest(details, situation))
}

function redirect(req: Request, res) {
  const redirectTo = req.redirectTo || req?.query?.to || "/resultats"
  res.redirect(`/simulation/redirect${redirectTo ? `?to=${redirectTo}` : ""}`)
}

function enrichBenefitsList(benefits) {
  return benefits
    .map((benefit) => {
      const fullBenefit = allBenefits.all.find(
        (b) => b.slug === benefit.id || b.id === benefit.id,
      )

      if (!fullBenefit) {
        // This case handle when a benefit has been removed
        return
      }

      return {
        ...fullBenefit,
        ...benefit,
        montant: benefit.amount,
      }
    })
    .filter((b) => b)
}

async function getLatestFollowup(req: Request, res) {
  const followup = (await Followups.findOne(
    {
      simulation: req.simulation?._id,
    },
    null,
    { sort: { createdAt: -1 } },
  )) as Followup

  if (!followup) {
    return res.status(404).send({ error: "No followup found" })
  }

  try {
    followup.benefits = enrichBenefitsList(followup.benefits)

    return res.send(followup)
  } catch (error) {
    console.error(error)
    Sentry.captureException(error)
    return res.status(500).send({ error: "Error while fetching followup" })
  }
}

export default {
  simulation,
  attachAccessCookie,
  validateAccess,
  show,
  create,
  openfiscaResponse,
  openfiscaTrace,
  openfiscaRequest,
  openfiscaTest,
  redirect,
  results,
  getLatestFollowup,
}
