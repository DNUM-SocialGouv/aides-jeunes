// Source : Matomo, sommé mois par mois :
// - simulations terminées : objectif n°1 « Simulation terminée »
// - affichages et consultations : événements "show" et "showDetails" de chaque dispositif
import { callMatomo, monthsOf } from "./matomo.js"

const BENEFITS = {
  css_participation_forfaitaire: "CSS",
  aide_logement: "Aide au logement",
  ppa: "Prime d'activité",
  rsa: "RSA",
  bourse_criteres_sociaux: "Bourse sur critères sociaux",
}

async function countMonthly(date: string) {
  const goal = await callMatomo({ method: "Goals.get", idGoal: 1, date })
  const names = await callMatomo({ method: "Events.getName", date })
  const benefits = {}
  for (const id of Object.keys(BENEFITS)) {
    const name = names.find((name) => name.label === id)
    const actions = name
      ? await callMatomo({
          method: "Events.getActionFromNameId",
          idSubtable: name.idsubdatatable,
          date,
        })
      : []
    const find = (label: string) =>
      actions.find((action) => action.label === label)
    benefits[id] = {
      show: find("show")?.nb_events || 0,
      // nombre de simulations différentes où le dispositif est affiché (une
      // simulation peut afficher plusieurs fois la page de résultats)
      simulationsWithShow: find("show")?.nb_visits || 0,
      showDetails: find("showDetails")?.nb_events || 0,
    }
  }
  return { simulations: Number(goal.nb_conversions) || 0, benefits }
}

async function run() {
  const months = await Promise.all(monthsOf(2026).map(countMonthly))
  const simulations = months.reduce((sum, month) => sum + month.simulations, 0)
  const totals = Object.keys(BENEFITS).map((id) => {
    const sum = (field: string) =>
      months.reduce((total, month) => total + month.benefits[id][field], 0)
    return {
      show: sum("show"),
      showPercentage: (
        (100 * sum("simulationsWithShow")) /
        simulations
      ).toFixed(1),
      showDetails: sum("showDetails"),
      rate: ((100 * sum("showDetails")) / sum("show")).toFixed(1),
    }
  })
  const row = (label: string, values: string[]) =>
    `| ${label} | ${values.join(" | ")} |`

  console.log(`Simulations terminées en 2026 : ${simulations}\n`)
  console.log(
    [
      row("Indicateur", Object.values(BENEFITS)),
      row(
        "---",
        totals.map(() => "---:"),
      ),
      row(
        "Affichages (show)",
        totals.map((t) => `${t.show}`),
      ),
      row(
        "Taux d'affichage (simulations où le dispositif est affiché / simulations terminées)",
        totals.map((t) => `${t.showPercentage} %`),
      ),
      row(
        "Consultations de la fiche (showDetails)",
        totals.map((t) => `${t.showDetails}`),
      ),
      row(
        "Taux de consultation (showDetails / show)",
        totals.map((t) => `${t.rate} %`),
      ),
    ].join("\n"),
  )
}

export default {
  label:
    "CSS, aide au logement, prime d'activité, RSA, bourse : affichages et consultations en 2026 (Matomo)",
  run,
}
