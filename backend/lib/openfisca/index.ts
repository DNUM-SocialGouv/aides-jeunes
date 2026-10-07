import config from "../../config/index.js"
import mapping from "./mapping/index.js"
import axios from "axios"
import * as Sentry from "@sentry/node"

export const buildOpenFiscaRequest = mapping.buildOpenFiscaRequest

// Le corps d'erreur remonte jusqu'au client et jusqu'aux logs. Un AxiosError
// brut y ferait figurer `config.data`, c'est-à-dire la situation personnelle
// complète, ainsi que les chemins du serveur.
//
// Le résultat doit toujours être vrai : les appelants suivent la convention
// `callback(err, result)` et testent `if (err)`. Une réponse d'erreur HTTP à
// corps vide donne `response.data === ""`, qu'il faut donc écarter.
function isTransportError(err: any): boolean {
  return Boolean(err?.isAxiosError || err?.config || err?.response)
}

export function normalizeError(err: any) {
  const body = err?.response?.data
  // Un corps d'erreur structuré vient d'OpenFisca et sert au diagnostic. Une
  // chaîne vient d'un intermédiaire — page 502 de nginx, trace de gunicorn — et
  // doit rester une chaîne : la traiter comme un objet la déploierait en un
  // dictionnaire indexé caractère par caractère.
  if (body && typeof body === "object") {
    return body
  }

  return {
    name: err?.name || "Error",
    code: err?.code,
    status: err?.response?.status,
    // Le message d'axios porte l'adresse interne du service sur les erreurs
    // réseau. Seul celui d'un abandon est sûr, et le front s'en sert pour
    // reconnaître un calcul trop long.
    message:
      err?.code === "ECONNABORTED"
        ? err.message
        : "Le calcul n'a pas abouti. Merci de réessayer dans un instant.",
  }
}

// `config.openfiscaTimeout` budgète le calcul d'une situation. Un appel qui en
// empile plusieurs — le tracé d'une variable sur un axe — coûte un multiple de
// ce temps et déclare son propre budget.
export function sendToOpenfisca(
  endpoint,
  transform?: any,
  { timeout = config.openfiscaTimeout }: { timeout?: number } = {},
) {
  if (!transform) {
    transform = buildOpenFiscaRequest
  }

  return function (situation, callback) {
    let request
    try {
      request = transform(situation)
    } catch (e: any) {
      Sentry.captureException(e)
      return callback(normalizeError(e))
    }

    axios
      .post(`${config.openfiscaURL}/${endpoint}`, request, { timeout })
      .then((response) => {
        // Une réponse vide n'est pas un résultat : la laisser passer ferait
        // échouer le calcul des aides plus loin, hors du chemin d'erreur.
        if (!response.data) {
          throw Object.assign(new Error("Empty response from OpenFisca"), {
            code: "ERR_EMPTY_RESPONSE",
          })
        }
        return response.data
      })
      .then(function (result) {
        callback(null, result)
      })
      .catch((err) => {
        // Ce `catch` couvre aussi ce que lève le callback lui-même, donc le
        // calcul des aides. Assainir une exception applicative en effacerait le
        // message et la pile, dans les logs comme dans Sentry : seules les
        // erreurs de transport sont normalisées.
        //
        // La reconnaissance ne repose pas sur le seul `isAxiosError` : porter
        // `config` ou `response`, c'est porter la requête sortante et donc la
        // situation personnelle, quelle que soit l'origine.
        if (isTransportError(err)) {
          // L'objet transmis est volontairement pauvre : le message d'origine,
          // qui distingue un refus de connexion d'un abandon ou d'un 502, est
          // conservé côté serveur pour rester diagnosticable.
          console.error(`OpenFisca ${endpoint} request failed`, err.message)
          return callback(normalizeError(err))
        }
        Sentry.captureException(err)
        callback(err)
      })
  }
}

export const calculate = sendToOpenfisca("calculate")
export const trace = sendToOpenfisca("trace")

export default {
  buildOpenFiscaRequest,
  calculate,
  trace,
  sendToOpenfisca,
}
