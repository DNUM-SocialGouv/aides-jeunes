import { SimulationStatus } from "./enums/simulation.js"

function getAnonymizedAnswer(answer, simulation) {
  switch (answer.entityName) {
    case "famille": {
      switch (answer.fieldName) {
        case "en_couple": {
          return answer
        }
        default: {
          return null
        }
      }
    }
    case "menage": {
      switch (answer.fieldName) {
        case "depcom":
        case "loyer":
        case "statut_occupation_logement":
        case "_logementType":
        case "_primoAccedant":
        case "_locationType": {
          return answer
        }
        default: {
          return null
        }
      }
    }
    case "individu": {
      if (answer.id == "demandeur" || answer.id == "conjoint") {
        switch (answer.fieldName) {
          case "_contratAlternance":
          case "_hasRessources":
          case "_interetAidesSanitaireSocial":
          case "_interetBafa":
          case "_interetEtudesEtranger":
          case "_interetUnivParisCite":
          case "_interetPermisDeConduire":
          case "_interetsAidesVelo":
          case "activite":
          case "service_civique":
          case "age":
          case "alternant":
          case "boursier":
          case "depcom":
          case "enfant_a_charge":
          case "nationalite":
          case "ressources": {
            return answer
          }
          case "date_naissance": {
            const dt = new Date(simulation.dateDeValeur)
            const dob = new Date(answer.value)
            return {
              id: answer.id,
              entityName: answer.entityName,
              fieldName: "age",
              value: Math.round(
                (dt.getTime() - dob.getTime()) / 365.25 / 24 / 60 / 60 / 1000,
              ),
            }
          }
          default: {
            return null
          }
        }
      } else {
        return null
      }
    }
    default: {
      return null
    }
  }
}

export function anonymizeSimulation(simulation) {
  const answers = simulation.answers.all
  const answersAnonymized = answers
    .map((answer) => getAnonymizedAnswer(answer, simulation))
    .filter((answer) => answer)

  simulation.answers = {
    all: answersAnonymized,
    current: [],
  }
  simulation.status = SimulationStatus.Anonymized

  return simulation
}

export function anonymizeFollowup(followup) {
  followup.email = undefined
  followup.phone = undefined
  followup.error = undefined
  return followup
}
