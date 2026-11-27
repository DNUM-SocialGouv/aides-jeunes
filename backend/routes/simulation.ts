import express, { Express } from "express"
import cookieParser from "cookie-parser"
import cors from "cors"
import { rateLimit } from "express-rate-limit"

import { persist } from "../controllers/followups.js"
import simulationController from "../controllers/simulation.js"
import simulationDemo from "../controllers/simulation-demo.js"
import teleservices from "../controllers/teleservices/index.js"

export default function (api: Express) {
  api.options("/simulation", cors())
  api
    .route("/simulation")
    .post(
      cors({ origin: "*" }),
      cookieParser(),
      express.json(),
      simulationController.create,
      simulationController.attachAccessCookie,
      simulationController.show,
    )

  const route = express.Router({ mergeParams: true })
  route.use(cookieParser())

  route.use(simulationController.validateAccess)

  route.get("/", simulationController.show)
  route.get("/openfisca-response", simulationController.openfiscaResponse)
  route.get("/results", simulationController.results)
  route.get("/followup", simulationController.getLatestFollowup)

  route.get(
    "/redirect",
    simulationController.attachAccessCookie,
    simulationController.redirect,
  )

  // Enable CORS for openfisca-tracer
  route.options("/openfisca-request", cors())
  route.get(
    "/openfisca-request",
    cors({ origin: "*" }),
    simulationController.openfiscaRequest,
  )

  route.post(
    "/openfisca-test",
    express.json(),
    simulationController.openfiscaTest,
  )
  route.get("/openfisca-trace", simulationController.openfiscaTrace)

  const ONE_HOUR_MS = 60 * 60 * 1000
  const isSendingMessage = (req) => Boolean(req.body?.email || req.body?.phone)
  const message = {
    error: "Une erreur est survenue. Veuillez réessayer plus tard.",
  }
  const followupPerSimulationLimiter = rateLimit({
    windowMs: ONE_HOUR_MS,
    limit: 5,
    keyGenerator: (req) => req.params.simulationId,
    skip: (req) => !isSendingMessage(req),
    standardHeaders: true,
    legacyHeaders: false,
    message,
  })
  const followupPerIpLimiter = rateLimit({
    windowMs: ONE_HOUR_MS,
    limit: 30,
    skip: (req) => !isSendingMessage(req),
    standardHeaders: true,
    legacyHeaders: false,
    message,
  })

  route.post(
    "/followup",
    express.json(),
    followupPerSimulationLimiter,
    followupPerIpLimiter,
    persist,
  )

  teleservices.names.forEach(function (name) {
    route.get(
      `/${name}`,
      cors({ origin: "*" }),
      teleservices.metadataResponseGenerator(teleservices[name]),
    )
  })

  api.options("/simulation/via/:signedPayload", cors())
  api.get(
    "/simulation/via/:signedPayload",
    cors({ origin: "*" }),
    teleservices.checkCredentials,
    teleservices.attachPayloadSituation,
    teleservices.verifyRequest,
    teleservices.exportRepresentation,
  )

  api.get("/simulation/demo", cors({ origin: "*" }), simulationDemo.get)

  const specificSimulationRoutes = express.Router({ mergeParams: true })
  api.use("/simulation/", specificSimulationRoutes)
  specificSimulationRoutes.use("/:simulationId/", route)

  /*
   ** Param injection
   */
  specificSimulationRoutes.param(
    "simulationId",
    simulationController.simulation,
  )
  api.param("signedPayload", teleservices.decodePayload)
}
