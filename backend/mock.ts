import axios from "axios"
import express from "express"
import outils from "./controllers/outils.js"
import mapping from "./lib/openfisca/mapping/index.js"
import openfiscaParameters from "./lib/openfisca/parameters.js"
import pollResult from "./lib/mattermost-bot/poll-result.js"
import { generateSituation } from "../lib/situations.js"
import { computeAides } from "../lib/benefits/compute.js"
import benefits from "../data/all.js"
import { Situation } from "../lib/types/situations.js"

const computeBenefits = computeAides.bind(benefits)

const openfiscaRoot = "https://openfisca.mes-aides.1jeune1solution.beta.gouv.fr"
const buildOpenFiscaRequest = mapping.buildOpenFiscaRequest

function sendToOpenfisca(situation, callback) {
  let request
  try {
    request = buildOpenFiscaRequest(situation)
  } catch (e: any) {
    return callback({
      message: e.message,
      name: e.name,
      stack: e.stack,
    })
  }
  axios
    .post(`${openfiscaRoot}/calculate`, request)
    .then((response) => response.data)
    .then((result) => {
      callback(null, result)
    })
    .catch(callback)
}

const ID = function () {
  // Math.random should be unique because of its seeding algorithm.
  // Convert it to base 36 (numbers + letters), and grab the first 9 characters
  // after the decimal.
  return `_${Math.random().toString(36).substr(2, 9)}`
}

function mock(app: express.Application) {
  app.use(express.json())

  const cache = {}
  app.route("/api/outils/communes/:codePostal").get(outils.communes)
  app.post("/api/simulation", function (req, res) {
    const data = Object.assign({ _id: ID() }, req.body)
    cache[data._id] = data
    res.send(data)
  })

  app.get("/api/simulation/:id", function (req, res) {
    res.send(cache[req.params.id])
  })

  app.get("/api/simulation/:id/results", function (req, res, next) {
    try {
      const simulation = cache[req.params.id]
      const situation = generateSituation(simulation) as Situation
      sendToOpenfisca(situation, async function (err, result) {
        if (err) {
          return next(err)
        }
        const mockResultSimulation = await computeBenefits(
          situation,
          req.params.id,
          result,
          false,
        )
        res.send(
          Object.assign(
            { _id: cache[req.params.id]._id },
            mockResultSimulation,
          ),
        )
      })
    } catch {
      res.sendStatus(404)
    }
  })

  app.get("/api/simulation/:id/openfisca-request", function (req, res) {
    try {
      const simulation = cache[req.params.id]
      const situation = generateSituation(simulation)
      res.send(buildOpenFiscaRequest(situation))
    } catch {
      res.sendStatus(404)
    }
  })

  app.get("/api/openfisca/missingbenefits", function (req, res) {
    res.send([])
  })

  app.get("/api/openfisca/parameters/:timestamp", function (req, res) {
    res.send(openfiscaParameters.parametersList)
  })

  app.get("/api/followups/surveys/:id", function (req, res) {
    res.send({
      benefits: [
        { id: "ppa", amount: 42 },
        { id: "rsa", amount: 145 },
        { id: "aide_logement", amount: 125 },
        { id: "livret_epargne_populaire_taux" },
      ],
    })
  })

  app.post("/api/followups/surveys/:id/answers", function (req, res) {
    pollResult
      .postPollResult({ _id: "mock-id" }, req.body)
      .catch((error) => console.error("Notification Mattermost", error))
    res.sendStatus(201)
  })

  app.use(function (err, req, res, next) {
    res
      .status(err.response?.status || 500)
      .send(err.response?.data || err.message || err.error || err)
    next()
  })
}

export default mock
