// Source : Matomo, Comportement > Événements > Actions de l'événement > "show"
// (une sous-ligne par dispositif affiché dans une page de résultats)
import Benefits from "../../data/all.js"
import { EventAction } from "../../lib/enums/event.js"
import { countDisplaysByLevel } from "../../lib/matomo-benefits-by-level.js"
import { callMatomo, monthsOf } from "./matomo.js"

async function fetchMonthlyDisplays(date: string) {
  const actions = await callMatomo({ method: "Events.getAction", date })
  const show = actions.find((action) => action.label === EventAction.Show)
  if (!show) {
    return []
  }
  const benefits = await callMatomo({
    method: "Events.getNameFromActionId",
    idSubtable: show.idsubdatatable,
    date,
  })
  return benefits.map(({ label, nb_events }) => ({
    id: label,
    count: nb_events,
  }))
}

async function run() {
  const months = monthsOf(2026)
  const displays = (await Promise.all(months.map(fetchMonthlyDisplays))).flat()
  const levelsById = Object.fromEntries(
    Benefits.all.map((benefit) => [benefit.id, benefit.institution?.type]),
  )

  console.log("| Échelon | Affichages | Pourcentage |\n|---|---:|---:|")
  for (const { label, count, percentage } of countDisplaysByLevel(
    displays,
    levelsById,
  )) {
    console.log(`| ${label} | ${count} | ${percentage.toFixed(2)} % |`)
  }
  const total = displays.reduce((sum, { count }) => sum + count, 0)
  console.log(`| **Total** | **${total}** | **100 %** |`)
}

export default {
  label:
    "Répartition par échelon des dispositifs affichés dans les résultats en 2026",
  run,
}
