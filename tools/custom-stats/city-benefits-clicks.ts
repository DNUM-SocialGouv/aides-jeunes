// Source : bases MongoDB de production (en lecture seule)
// - db_aides_jeunes.simulations : simulations terminées dans la commune
// - db_stats_recorder.records : affichages et ouvertures de fiche des aides
//
// Les aides d'une ville sont en principe réservées à ses habitants. Le taux
// d'affichage rapporte des visiteurs à des simulations : c'est une approximation.
// Les hash_id "uid_" (visiteur non identifié) sont exclus des décomptes de
// visiteurs.
import { MongoClient } from "mongodb"

import Benefits from "../../data/all.js"
import { EventAction } from "../../lib/enums/event.js"
import { PRODUCTION_MONGODB_URL, withSshTunnel } from "./ssh-tunnel.js"

const YEAR = 2026
const DETAILS_ACTIONS = [
  EventAction.ShowDetails,
  EventAction.ShowDetailsFromGroupPage, // fiche ouverte depuis un groupe (test A/B aides_bafa)
]

// Simulations terminées dans l'année par un foyer résidant dans la commune
export function countCitySimulations(client: MongoClient, codeInsee: string) {
  return client
    .db()
    .collection("simulations")
    .countDocuments({
      "answers.all": {
        $elemMatch: { fieldName: "depcom", "value.depcom": codeInsee },
      },
      finishedAt: {
        $gte: new Date(`${YEAR}-01-01`),
        $lt: new Date(`${YEAR + 1}-01-01`),
      },
    })
}

async function run(city: string, institution: string) {
  const benefits = Benefits.all.filter(
    (benefit) => benefit.institution?.slug === institution,
  )
  const codeInsee = benefits[0]?.institution.code_insee
  if (!codeInsee) {
    throw new Error(`Code INSEE introuvable pour l'institution ${institution}`)
  }
  const benefitIds = benefits.map((benefit) => benefit.id)
  const period = {
    $gte: new Date(`${YEAR}-01-01`),
    $lt: new Date(`${YEAR + 1}-01-01`),
  }

  const client = await MongoClient.connect(PRODUCTION_MONGODB_URL)
  try {
    const simulations = await countCitySimulations(client, codeInsee)

    const visitors = (eventTypes: string[]) =>
      client
        .db("db_stats_recorder")
        .collection("records")
        .distinct("hash_id", {
          event_type: { $in: eventTypes },
          created_at: period,
          benefit_id: { $in: benefitIds },
          hash_id: { $not: /^uid_/ },
        })
    const shownTo = new Set(await visitors([EventAction.Show]))
    const clickedBy = (await visitors(DETAILS_ACTIONS)).filter((hashId) =>
      shownTo.has(hashId),
    )

    // Comptage par aide : tous les événements, visiteurs non identifiés compris
    const events = await client
      .db("db_stats_recorder")
      .collection("records")
      .aggregate([
        {
          $match: {
            event_type: { $in: [EventAction.Show, ...DETAILS_ACTIONS] },
            created_at: period,
            benefit_id: { $in: benefitIds },
          },
        },
        {
          $group: {
            _id: "$benefit_id",
            displays: {
              $sum: {
                $cond: [{ $eq: ["$event_type", EventAction.Show] }, 1, 0],
              },
            },
            clicks: {
              $sum: {
                $cond: [{ $in: ["$event_type", DETAILS_ACTIONS] }, 1, 0],
              },
            },
          },
        },
      ])
      .toArray()
    const rows = benefits
      .map((benefit) => {
        const counts = events.find((event) => event._id === benefit.id)
        return {
          label: benefit.label,
          displays: counts?.displays || 0,
          clicks: counts?.clicks || 0,
        }
      })
      .sort((a, b) => b.displays - a.displays)

    const percentage = (part: number, total: number) =>
      total ? `${((100 * part) / total).toFixed(1)} %` : "-"

    console.log("| Indicateur | Valeur |\n|---|---:|")
    console.log(
      `| Simulations terminées à ${city} en ${YEAR} | ${simulations} |`,
    )
    console.log(
      `| Visiteurs ayant vu au moins une aide de la ville | ${shownTo.size} |`,
    )
    console.log(
      `| Taux d'affichage (visiteurs / simulations, approximation) | ${percentage(shownTo.size, simulations)} |`,
    )
    console.log(
      `| Visiteurs ayant ouvert la fiche d'au moins une aide de la ville | ${clickedBy.length} |`,
    )
    console.log(
      `| Taux de clic (visiteurs ayant ouvert une fiche / visiteurs exposés) | ${percentage(clickedBy.length, shownTo.size)} |`,
    )

    console.log(
      `\nDétail par aide de la ville en ${YEAR}\n\n| Aide | Affichages | Clics (ouverture de la fiche) | Taux de clic |\n|---|---:|---:|---:|`,
    )
    for (const { label, displays, clicks } of rows) {
      console.log(
        `| ${label} | ${displays} | ${clicks} | ${percentage(clicks, displays)} |`,
      )
    }
    const sum = (field: "displays" | "clicks") =>
      rows.reduce((total, row) => total + row[field], 0)
    console.log(
      `| **Total** | **${sum("displays")}** | **${sum("clicks")}** | **${percentage(sum("clicks"), sum("displays"))}** |`,
    )
  } finally {
    await client.close()
  }
}

export function cityBenefitsClicks(city: string, institution: string) {
  return {
    label: `Ville de ${city} : taux d'affichage et de clic sur les aides de la ville en ${YEAR} (MongoDB)`,
    run: () => withSshTunnel(() => run(city, institution)),
  }
}
