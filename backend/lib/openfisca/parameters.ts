import * as Sentry from "@sentry/node"
import openfisca from "./getter.js"

import { OpenfiscaParameters } from "../../../lib/types/parameters.js"
// La liste est partagée avec le navigateur, qui s'en sert de valeur initiale.
import { parametersList } from "../../../lib/openfisca-parameters.js"

export { parametersList }

// Délai avant qu'une tentative échouée puisse être relancée. Sans lui, chaque
// appel de `getParameters` — un par droit calculé — repartirait sur le réseau
// et s'ajouterait à la charge d'un OpenFisca déjà en difficulté.
//
// Ce qu'il coûte, en regard : pendant une panne, une tentative toutes les
// trente secondes quelle que soit la charge, soit six cents requêtes par heure
// et par processus, bornées par le temps et non par le trafic. C'est le prix
// d'un rétablissement en trente secondes plutôt qu'au redémarrage.
const FAILURE_COOLDOWN_MS = 30_000

let parameterPromise
let parameters

async function fetchParameters() {
  const values = await Promise.all(
    Object.keys(parametersList).map((parameter) =>
      openfisca.getPromise(`/parameter/${parameter}`),
    ),
  )

  const newParameters = {}
  values.forEach((value) => {
    newParameters[value.id] = value.values
  })
  return newParameters
}

function requestParameters() {
  if (!parameterPromise) {
    parameterPromise = fetchParameters()
      .then((values) => {
        parameters = values
        return values
      })
      // Une tentative échouée n'est pas conservée indéfiniment : elle figerait
      // une indisponibilité passagère d'OpenFisca pour toute la durée de vie du
      // processus, et les paramètres resteraient sur leurs valeurs de repli
      // jusqu'au redémarrage.
      .catch((error) => {
        const retry: any = setTimeout(() => {
          parameterPromise = undefined
        }, FAILURE_COOLDOWN_MS)
        // `unref` n'existe que sur les minuteurs de Node : ce délai d'attente
        // ne doit pas à lui seul retenir un processus prêt à se terminer.
        retry.unref?.()
        throw error
      })
    // `getParameters` est synchrone et ne peut pas attendre cette promesse :
    // sans ce gestionnaire terminal, son rejet abattrait le processus. L'échec
    // est déjà journalisé par le getter et signalé par `computeParameter`.
    parameterPromise.catch(() => undefined)
  }
  return parameterPromise
}

function computeParameter(parameter, date) {
  const values = parameters?.[parameter]
  if (values) {
    const closestDate = Object.keys(values)
      .reverse()
      .find((valueDate) => new Date(valueDate) < date)
    if (closestDate) {
      return values[closestDate]
    }
  }
  Sentry.captureMessage("Openfisca parameters are not loaded", (scope) => {
    return scope.setContext("parameters", {
      date,
      parameter,
      parameters,
    })
  })
  return parametersList[parameter]
}

export function getParameter(parameter, date) {
  return computeParameter(parameter, date)
}

export function getParameters_(date): OpenfiscaParameters {
  const results = {}
  Object.keys(parametersList).forEach((parameter) => {
    results[parameter] = computeParameter(parameter, date)
  })
  return results as OpenfiscaParameters
}

export function getParameters(date): OpenfiscaParameters {
  requestParameters()
  return getParameters_(date)
}

export async function getParametersAsync(date): Promise<OpenfiscaParameters> {
  try {
    await requestParameters()
  } catch (error: any) {
    // Échouer ici priverait le navigateur de TOUT paramètre. Les paliers de la
    // question du taux d'incapacité se calculent à partir de l'un d'eux : sans
    // lui, deux des trois options vaudraient NaN, que JSON écrit `null`, et
    // cette valeur s'enregistrerait définitivement à la place de la réponse.
    // `computeParameter` sert alors les valeurs de `parametersList` et le
    // signale à Sentry : le repli est daté, tracé, et jamais muet.
    console.error(
      "OpenFisca parameters unavailable, serving fallback values",
      error.message,
    )
  }
  return getParameters_(date)
}

export default {
  parametersList,
  getParameter,
  getParameters,
  getParametersAsync,
}
