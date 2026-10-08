// Source : Matomo, Comportement > Événements > Noms d'événements >
// ville-montpellier-accompagnement (une sous-ligne par action de l'usager).
// Les actions "teleservice" et "link" de ce dispositif pointent toutes les deux
// vers la prise de rendez-vous.
import { callMatomo, monthsOf } from "./matomo.js"

const BENEFIT_ID = "ville-montpellier-accompagnement"
const APPOINTMENT_ACTIONS = ["teleservice", "link"]

async function countMonthlyClicks(date: string) {
  const names = await callMatomo({ method: "Events.getName", date })
  const benefit = names.find((name) => name.label === BENEFIT_ID)
  if (!benefit) {
    return 0
  }
  const actions = await callMatomo({
    method: "Events.getActionFromNameId",
    idSubtable: benefit.idsubdatatable,
    date,
  })
  return actions
    .filter((action) => APPOINTMENT_ACTIONS.includes(action.label))
    .reduce((sum, action) => sum + action.nb_events, 0)
}

async function run() {
  const clicks = await Promise.all(monthsOf(2026).map(countMonthlyClicks))
  const total = clicks.reduce((sum, count) => sum + count, 0)
  console.log(`${total} clics vers la prise de RDV téléphonique en 2026`)
}

export default {
  label: "Ville de Montpellier : clics vers le RDV téléphonique en 2026",
  run,
}
