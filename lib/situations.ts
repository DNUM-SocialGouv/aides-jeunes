import Ressource from "./ressource.js"
import { ressourceTypes } from "./resources.js"
import { datesGenerator } from "./dates.js"
import ScolariteCategories from "./scolarite.js"
import { Individu } from "./types/individu.js"
import { Situation } from "./types/situations.js"
import Logement from "./logement.js"

const generateDefaultIndividu = (role: string, id: string): Individu => ({
  id: id,
  annee_etude: undefined,
  date_naissance: undefined,
  enfant_a_charge: {},
  nationalite: undefined,
  _role: role,
})

const getIndividu = (situation: Situation, id: string) => {
  let individu
  switch (id) {
    case "demandeur": {
      individu = situation.demandeur
      break
    }
    case "conjoint": {
      individu = situation.conjoint
      break
    }
    default: {
      const [role] = id.split("_")
      if (role === "enfant") {
        individu = situation.enfants?.find((enfant) => enfant.id == id)
      }
      break
    }
  }
  return individu
}

function sanitizeFirstName(value: unknown): string {
  return typeof value === "string" ? value.replace(/[<>]/g, "") : ""
}

export function generateSituation(
  simulation,
  useAll?: any,
): Situation | Record<string, never> {
  if (!simulation) {
    return {}
  }
  const dates = datesGenerator(simulation.dateDeValeur)
  const situation: Situation = {
    dateDeValeur: simulation.dateDeValeur,
    version: simulation.version,
    demandeur: generateDefaultIndividu("demandeur", "demandeur"),
    enfants: simulation?.enfants
      ? simulation.enfants.map((enfant, index) => {
          const countDiplay = index + 1
          const _firstName = `votre ${countDiplay}${
            countDiplay === 1 ? "ᵉʳ" : "ᵉ"
          } enfant`

          return {
            ...generateDefaultIndividu("enfant", `enfant_${enfant}`),
            _firstName,
          }
        })
      : null,
    famille: {},
    menage: {
      aide_logement_date_pret_conventionne: "2018-12-31",
    },
    parents: {},
  }

  if (!simulation) {
    return situation
  }

  const allAnswers = useAll
    ? simulation.answers.all
    : simulation.answers.current
  allAnswers.forEach((answer) => {
    if (answer.entityName === "individu") {
      if (answer.id === "enfants") {
        answer.value.forEach((response) => {
          const enfant = situation?.enfants?.find(
            (enfant) => enfant.id == response.id,
          )
          if (enfant) {
            enfant[answer.fieldName] =
              answer.fieldName === "_firstName"
                ? sanitizeFirstName(response.value)
                : response.value
          }
        })
      } else {
        const individu = getIndividu(situation, answer.id)
        if (individu) {
          switch (answer.fieldName) {
            case "_firstName": {
              individu._firstName = sanitizeFirstName(answer.value)
              break
            }
            case "_bourseCriteresSociauxCommuneDomicileFamilial": {
              individu["_bourseCriteresSociauxCommuneDomicileFamilial"] =
                answer.value.depcom
              break
            }
            case "enfant_a_charge": {
              individu["enfant_a_charge"][dates.thisYear.id] = answer.value
              break
            }
            case "groupe_specialites_formation": {
              individu["groupe_specialites_formation"] = answer.value
              individu["_interetAidesSanitaireSocial"] =
                individu["_interetAidesSanitaireSocial"] ||
                answer.value ===
                  ScolariteCategories.groupeSpecialitesFormation
                    .specialites_plurivalentes_sanitaires_et_sociales.value
              break
            }
            case "_interetAidesSanitaireSocial": {
              individu["_interetAidesSanitaireSocial"] =
                answer.value ||
                individu["groupe_specialites_formation"] ===
                  ScolariteCategories.groupeSpecialitesFormation
                    .specialites_plurivalentes_sanitaires_et_sociales.value
              break
            }
            case "statut_marital": {
              const demandeur = getIndividu(situation, "demandeur")
              // conjointe
              individu["statut_marital"] = answer.value
              demandeur["statut_marital"] = answer.value
              break
            }
            case "ressources": {
              answer.value.forEach((ressource) => {
                Ressource.setDefaultValueForCurrentYear(
                  dates,
                  individu,
                  ressourceTypes.find(
                    (ressourceType) => ressourceType.id === ressource,
                  ),
                )
              })
              break
            }
            case "rpns":
            case "revenusActivite":
            case "indemnites":
            case "pensions":
            case "autre":
            case "patrimoine":
            case "allocations": {
              const declaredRessources = allAnswers.find(
                (a) =>
                  a.entityName === answer.entityName &&
                  a.id === answer.id &&
                  a.fieldName === "ressources",
              )
              answer.value.forEach((ressource) => {
                if (declaredRessources?.value.includes(ressource.id)) {
                  individu[ressource.id] = ressource.amounts
                }
              })
              break
            }
            default: {
              individu[answer.fieldName] = answer.value
              break
            }
          }
        }
      }
    } else {
      if (answer.fieldName === "depcom" || answer.fieldName === "loyer") {
        Object.keys(answer.value).forEach(
          (key) => (situation[answer.entityName][key] = answer.value[key]),
        )
      } else if (answer.fieldName === "en_couple") {
        situation[answer.entityName][answer.fieldName] = answer.value
        if (answer.value) {
          situation.conjoint = generateDefaultIndividu("conjoint", "conjoint")
        } else if (situation.demandeur) {
          situation.demandeur.statut_marital = "celibataire"
        }
      } else if (situation[answer.entityName]) {
        situation[answer.entityName][answer.fieldName] = answer.value
      }
    }
  })

  if (simulation.ressourcesFiscales) {
    const fiscalYear = dates.fiscalYear.id
    Object.keys(simulation.ressourcesFiscales).forEach((individuId) => {
      const individu = getIndividu(situation, individuId)
      if (individu) {
        const ressources = simulation.ressourcesFiscales[individuId]
        Object.keys(ressources).forEach((ressource) => {
          individu[ressource] = Object.assign({}, individu[ressource], {
            [fiscalYear]: ressources[ressource],
          })
        })
      }
    })
  }

  if (simulation.patrimoine) {
    const periodKey = "month:2019-01:120"
    Object.keys(simulation.patrimoine).forEach((key) => {
      situation.demandeur[key] = { [periodKey]: simulation.patrimoine[key] }
    })
  }

  if (situation && situation.menage) {
    situation.menage.statut_occupation_logement =
      Logement.getStatutOccupationLogement(situation.menage)
  }

  return situation
}
