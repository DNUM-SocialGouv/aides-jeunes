import axios from "axios"
import config from "../../config/index.js"

// Sans délai d'abandon, un OpenFisca saturé qui accepte la connexion sans
// répondre laisse ces requêtes en attente indéfiniment.
const requestOptions = { timeout: config.openfiscaTimeout }

// Le message d'axios porte l'adresse interne du service, et ces erreurs
// atteignent le client sur les routes anonymes /api/openfisca/*.
function unavailable(error) {
  console.error("OpenFisca request failed", error)
  return Object.assign(new Error("OF maybe offline - Failed to fetch data"), {
    code: error.code,
  })
}

function get(item: string, callback: (any) => void): Promise<void> {
  return (
    axios
      .get(`${config.openfiscaURL}${item}`, requestOptions)
      .then((response) => response.data)
      // Placé avant le callback, jamais en fin de chaîne : en fin de chaîne il
      // réécrirait aussi les exceptions levées par l'appelant.
      .catch((error) => {
        throw unavailable(error)
      })
      .then(function (result) {
        callback(result)
      })
  )
}

async function getPromise(item): Promise<any> {
  return axios
    .get(`${config.openfiscaURL}${item}`, requestOptions)
    .then((response) => response.data)
    .catch((error) => {
      throw unavailable(error)
    })
}

export default {
  get,
  getPromise,
}
