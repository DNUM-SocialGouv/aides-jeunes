// Source : Matomo, Acquisition > Campagnes. L'iframe de la Ville de Vannes
// (mise en place en 2025) est suivie par les campagnes ci-dessous.
// « Simulation terminée » est l'objectif Matomo n°1 (URL simulation/resultats).
import { callMatomo, monthsOf } from "./matomo.js"

const CAMPAIGNS = ["iframe@www.mairie-vannes.fr", "iframe@mairie-vannes.fr"]
const SIMULATION_COMPLETED_GOAL = "idgoal=1"

async function countMonthly(date: string) {
  const campaigns = await callMatomo({
    method: "Referrers.getCampaigns",
    date,
  })
  return campaigns
    .filter((campaign) => CAMPAIGNS.includes(campaign.label))
    .map((campaign) => ({
      visits: campaign.nb_visits,
      simulations:
        campaign.goals?.[SIMULATION_COMPLETED_GOAL]?.nb_conversions || 0,
    }))
}

async function run() {
  console.log("| Année | Visites depuis l'iframe | Simulations terminées |")
  console.log("|---|---:|---:|")
  for (const year of [2025, 2026]) {
    const counts = (await Promise.all(monthsOf(year).map(countMonthly))).flat()
    const visits = counts.reduce((sum, count) => sum + count.visits, 0)
    const simulations = counts.reduce(
      (sum, count) => sum + count.simulations,
      0,
    )
    console.log(`| ${year} | ${visits} | ${simulations} |`)
  }
}

export default {
  label: "Ville de Vannes : visites et simulations terminées depuis l'iframe",
  run,
}
