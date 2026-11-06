// Sources :
// - Matomo, Comportement > Événements > Noms d'événements >
//   ville-montpellier-accompagnement (une sous-ligne par action de l'usager).
//   Les actions "teleservice" et "link" de ce dispositif pointent toutes les
//   deux vers la prise de rendez-vous.
// - MongoDB de production : simulations terminées par un foyer montpelliérain.
//
// Les visites Matomo sont sommées mois par mois : un usager revenu plusieurs
// fois est compté plusieurs fois, c'est une approximation du nombre de
// personnes.
import { MongoClient } from "mongodb"

import { countCitySimulations } from "./city-benefits-clicks.js"
import { callMatomo, monthsOf } from "./matomo.js"
import { PRODUCTION_MONGODB_URL, withSshTunnel } from "./ssh-tunnel.js"

const BENEFIT_ID = "ville-montpellier-accompagnement"
const APPOINTMENT_ACTIONS = ["teleservice", "link"]
const CODE_INSEE_MONTPELLIER = "34172"

async function countMonthlyClicks(date: string) {
  const names = await callMatomo({ method: "Events.getName", date })
  const benefit = names.find((name) => name.label === BENEFIT_ID)
  if (!benefit) {
    return { clicks: 0, visits: 0 }
  }
  const actions = await callMatomo({
    method: "Events.getActionFromNameId",
    idSubtable: benefit.idsubdatatable,
    date,
  })
  const appointmentActions = actions.filter((action) =>
    APPOINTMENT_ACTIONS.includes(action.label),
  )
  return {
    clicks: appointmentActions.reduce((sum, a) => sum + a.nb_events, 0),
    // une visite ayant cliqué sur les deux actions est comptée deux fois
    visits: appointmentActions.reduce((sum, a) => sum + a.nb_visits, 0),
  }
}

async function run() {
  const months = await Promise.all(monthsOf(2026).map(countMonthlyClicks))
  const clicks = months.reduce((sum, month) => sum + month.clicks, 0)
  const visits = months.reduce((sum, month) => sum + month.visits, 0)

  const client = await MongoClient.connect(PRODUCTION_MONGODB_URL)
  try {
    const simulations = await countCitySimulations(
      client,
      CODE_INSEE_MONTPELLIER,
    )
    console.log("| Indicateur | Valeur |\n|---|---:|")
    console.log(`| Clics vers la prise de RDV téléphonique | ${clicks} |`)
    console.log(`| Visites avec au moins un clic (≈ personnes) | ${visits} |`)
    console.log(`| Simulations terminées à Montpellier | ${simulations} |`)
    console.log(
      `| Part des simulations montpelliéraines avec un clic (visites / simulations) | ${((100 * visits) / simulations).toFixed(1)} % |`,
    )
  } finally {
    await client.close()
  }
}

export default {
  label:
    "Ville de Montpellier : clics vers le RDV téléphonique en 2026, rapportés aux simulations (Matomo + MongoDB)",
  run: () => withSshTunnel(run),
}
