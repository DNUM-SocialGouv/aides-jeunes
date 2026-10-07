import Promise from "bluebird"

import config from "../../config/index.js"
import openfiscaImport from "../openfisca/index.js"

const openfisca = Promise.promisifyAll(openfiscaImport)
// La requête empile une situation par point du tracé : son coût est celui d'un
// calcul ordinaire multiplié par leur nombre, d'où un budget distinct.
const request = Promise.promisify(
  openfisca.sendToOpenfisca("calculate", (s) => s, {
    timeout: config.openfiscaBulkTimeout,
  }),
)

import bulk from "../openfisca/bulk/index.js"

const { build, extractResults } = bulk
import benefits from "../../../data/all.js"

function OpenFiscaAxe(simulation) {
  this.situation = simulation.getSituation()
}

OpenFiscaAxe.prototype.toInternal = function () {
  return {}
}
const benefitIds = ["irpp_economique"]
benefits.all.forEach((benefit) => {
  benefitIds.push(benefit.id)
})
const variable = "salaire_net"

function fetch(s) {
  return request(s.request)
    .then((payload) => {
      s.response = payload
    })
    .then(() => s)
}

OpenFiscaAxe.prototype.toExternal = function () {
  const s = {
    source: this.situation,
    request: build(this.situation, variable),
  }

  return fetch(s).then((s) => {
    const results = extractResults(s, benefitIds)
    const jsonResults = Object.keys(results).map((k) => {
      return Object.assign({ name: k }, results[k], { [variable]: parseInt(k) })
    })
    return {
      names: [variable].concat(benefitIds),
      data: jsonResults,
    }
  })
}

export default OpenFiscaAxe
