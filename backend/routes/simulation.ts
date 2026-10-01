import express, { Express } from "express"
import cookieParser from "cookie-parser"
import cors from "cors"

import { persist } from "../controllers/followups.js"
import simulationController from "../controllers/simulation.js"
import simulationDemo from "../controllers/simulation-demo.js"
import teleservices from "../controllers/teleservices/index.js"
import { asyncHandler } from "../lib/async-handler.js"

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

  route.post("/followup", express.json(), persist)

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

  api.get(
    "/simulation/demo",
    cors({ origin: "*" }),
    asyncHandler(simulationDemo.get),
  )

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
