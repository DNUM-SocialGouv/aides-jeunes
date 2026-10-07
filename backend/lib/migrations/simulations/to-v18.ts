/*
 * Supprime les réponses `taux_incapacite` enregistrées sans valeur exploitable.
 *
 * Les paliers de cette question sont les seuls du simulateur à être calculés à
 * partir d'un paramètre OpenFisca. Lorsque ce paramètre manquait, deux des
 * trois options valaient NaN — que JSON écrit `null` — et cette valeur
 * s'enregistrait à la place de la réponse. Le taux choisi est alors
 * irrécupérable : les deux paliers hauts donnaient le même NaN.
 *
 * La réponse est retirée plutôt que devinée : l'étape redevient sans réponse et
 * la question est reposée, avec des paliers désormais corrects. Corriger un
 * taux au jugé ferait varier l'AAH de plus de quatre cents euros par mois.
 */

import {
  fieldsToAnswerAgain,
  isUnusableAnswer,
} from "../../../../lib/simulation.js"

const VERSION = 18

// Seule la corruption réellement produite est visée. Écarter par le type
// retirerait une chaîne — « 0.9 » — qu'OpenFisca accepte, et que
// `POST /api/simulation`, public, peut légitimement recevoir.
function removeUnusableAnswers(answers) {
  return answers.filter(
    (answer) =>
      !fieldsToAnswerAgain.includes(answer.fieldName) ||
      !isUnusableAnswer(answer.value),
  )
}

export default {
  apply(simulation) {
    simulation.answers.all = removeUnusableAnswers(simulation.answers.all)
    simulation.answers.current = removeUnusableAnswers(
      simulation.answers.current,
    )

    return simulation
  },
  version: VERSION,
}
