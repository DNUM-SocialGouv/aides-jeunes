import mongoose from "mongoose"
import utils from "../lib/utils.js"
import openfisca from "../lib/openfisca/index.js"
import benefits from "../../data/all.js"
import { computeAides } from "../../lib/benefits/compute.js"
import { generateSituation } from "../../lib/situations.js"
import { version } from "../../lib/simulation.js"
import {
  ANSWER_ENTITY_NAMES,
  ANSWER_FIELD_NAMES,
  ANSWER_BASIC_IDS,
} from "../lib/definitions.js"

import { Simulation } from "../../lib/types/simulation.d.js"
import { SimulationModel } from "../types/models.js"
import { SimulationStatus } from "../../lib/enums/simulation.js"

const computeBenefits = computeAides.bind(benefits)

const answer = {
  entityName: {
    required: true,
    type: String,
    enum: ANSWER_ENTITY_NAMES,
  },
  fieldName: {
    type: String,
    enum: ANSWER_FIELD_NAMES,
  },
  id: {
    type: String,
    validate: {
      validator(value) {
        return ANSWER_BASIC_IDS.includes(value) || value.match(/^enfant_\d+$/)
      },
    },
  },
  value: Object,
}

const answers = {
  all: { type: [answer], required: true },
  current: { type: [answer], required: true },
}

const SimulationSchema = new mongoose.Schema<Simulation, SimulationModel>(
  {
    answers: { type: answers, required: true },
    enfants: [Number],
    ressourcesFiscales: Object,
    patrimoine: Object,
    dateDeValeur: {
      type: Date,
      required: true,
    },
    version: { type: Number, default: version },
    abtesting: { type: Map, of: String },
    finishedAt: Date,
    createdAt: { type: Date, default: Date.now },
    hasFollowup: Boolean,
    modifiedFrom: String,
    status: {
      type: String,
      default: SimulationStatus.New,
      enum: Object.values(SimulationStatus),
    },
    teleservice: String,
    token: String,
  },
  { minimize: false },
)

SimulationSchema.static("cookiePrefix", (): string => {
  return "simulation_"
})
SimulationSchema.virtual("cookieName").get(function () {
  return `simulation_${this._id}`
})

SimulationSchema.method("isAccessible", function (keychain) {
  if (
    [
      SimulationStatus.Demo,
      SimulationStatus.Investigation,
      SimulationStatus.Test,
    ].includes(this.status)
  ) {
    return true
  }

  // Sans token, aucune clé ne peut correspondre : comparer `undefined` à
  // `undefined` ouvrirait l'accès à toute requête n'en présentant aucun.
  if (!this.token) {
    return false
  }

  return (
    keychain?.[this.cookieName] === this.token ||
    keychain?.token === this.token ||
    keychain?.authorization === `Bearer ${this.token}`
  )
})
SimulationSchema.pre("save", async function (next) {
  if (!this.isNew) {
    return next()
  }
  this.token = await utils.generateToken()
  next()
})

SimulationSchema.method("getSituation", function () {
  return generateSituation(this)
})

SimulationSchema.method("compute", function (showPrivate) {
  const situation = this.getSituation()
  const id = String(this._id)
  return new Promise(function (resolve, reject) {
    openfisca.calculate(situation, function (err, openfiscaResponse) {
      if (err) {
        return reject(err)
      }

      const aides = computeBenefits(
        situation,
        id,
        openfiscaResponse,
        showPrivate,
      )
      resolve(aides)
    })
  })
})

export default mongoose.model<Simulation, SimulationModel>(
  "Simulation",
  SimulationSchema,
)
