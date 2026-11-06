// Sources :
// - Matomo, Comportement > Événements > Actions de l'événement : affichages
//   ("show") et consultations de la fiche ("showDetails" et
//   "showDetailsFromGroupPage"), sommés mois par mois. Les rapports mensuels
//   sont tronqués à 500 lignes, ce qui n'affecte pas les dispositifs du top 20.
// - MongoDB de production, collection followups : réponses « J'ai fait une
//   demande. » (asked) au sondage envoyé à J+7 (type benefit-action).
import { MongoClient } from "mongodb"

import Benefits from "../../data/all.js"
import { EventAction } from "../../lib/enums/event.js"
import { SurveyType } from "../../lib/enums/survey.js"
import { callMatomo, monthsOf } from "./matomo.js"
import { PRODUCTION_MONGODB_URL, withSshTunnel } from "./ssh-tunnel.js"

const YEAR = 2026
const TOP = 20

// Nombre d'événements par dispositif pour les actions données, sur l'année
async function countMatomoEvents(eventActions: string[]) {
  const counts: Record<string, number> = {}
  for (const date of monthsOf(YEAR)) {
    const actions = await callMatomo({ method: "Events.getAction", date })
    for (const action of actions) {
      if (!eventActions.includes(action.label)) {
        continue
      }
      const benefits = await callMatomo({
        method: "Events.getNameFromActionId",
        idSubtable: action.idsubdatatable,
        date,
      })
      for (const { label, nb_events } of benefits) {
        counts[label] = (counts[label] || 0) + nb_events
      }
    }
  }
  return counts
}

// Nombre de réponses et de demandes réalisées par dispositif, sur l'année
async function countAskedAnswers(): Promise<
  Record<string, { answers: number; asked: number }>
> {
  const client = await MongoClient.connect(PRODUCTION_MONGODB_URL)
  try {
    const benefits = await client
      .db()
      .collection("followups")
      .aggregate([
        { $match: { "surveys.type": SurveyType.BenefitAction } },
        { $unwind: "$surveys" },
        {
          $match: {
            "surveys.type": SurveyType.BenefitAction,
            "surveys.repliedAt": {
              $gte: new Date(`${YEAR}-01-01`),
              $lt: new Date(`${YEAR + 1}-01-01`),
            },
          },
        },
        { $unwind: "$surveys.answers" },
        {
          $group: {
            _id: "$surveys.answers.id",
            answers: { $sum: 1 },
            asked: {
              $sum: {
                $cond: [{ $eq: ["$surveys.answers.value", "asked"] }, 1, 0],
              },
            },
          },
        },
      ])
      .toArray()
    return Object.fromEntries(
      benefits.map(({ _id, answers, asked }) => [_id, { answers, asked }]),
    )
  } finally {
    await client.close()
  }
}

function benefitLabel(id: string) {
  const benefit = Benefits.all.find((benefit) => benefit.id === id)
  return benefit
    ? `${benefit.label} (${benefit.institution.label})`
    : `${id} (dispositif supprimé)`
}

function printTop(
  title: string,
  header: string,
  rows: { id: string; values: (string | number)[] }[],
) {
  console.log(`\n${title}\n`)
  console.log(`| # | Dispositif | ${header} |`)
  console.log(`|---:|---|${header.replace(/[^|]+/g, "---:")}|`)
  rows.slice(0, TOP).forEach(({ id, values }, index) => {
    console.log(
      `| ${index + 1} | ${benefitLabel(id)} | ${values.join(" | ")} |`,
    )
  })
}

function sortedByCount(counts: Record<string, number>) {
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([id, count]) => ({ id, values: [count] }))
}

async function run() {
  const displays = await countMatomoEvents([EventAction.Show])
  const details = await countMatomoEvents([
    EventAction.ShowDetails,
    EventAction.ShowDetailsFromGroupPage,
  ])
  const surveys = await withSshTunnelResult(countAskedAnswers)

  printTop(
    `Top ${TOP} des aides qui apparaissent le plus dans les résultats en ${YEAR}`,
    "Affichages",
    sortedByCount(displays),
  )
  printTop(
    `Top ${TOP} des aides dont la fiche est le plus consultée en ${YEAR}`,
    "Consultations de la fiche",
    sortedByCount(details),
  )
  printTop(
    `Top ${TOP} des aides pour lesquelles une demande a été réalisée (sondage J+7, réponses en ${YEAR})`,
    "Demandes réalisées | Réponses au sondage | Part de demandes",
    Object.entries(surveys)
      .sort(([, a], [, b]) => b.asked - a.asked)
      .map(([id, { answers, asked }]) => ({
        id,
        values: [asked, answers, `${((100 * asked) / answers).toFixed(1)} %`],
      })),
  )
}

async function withSshTunnelResult<T>(fetch: () => Promise<T>) {
  let result: T | undefined
  await withSshTunnel(async () => {
    result = await fetch()
  })
  return result as T
}

export default {
  label: `Top ${TOP} des aides affichées, consultées et demandées (sondage J+7) en ${YEAR} (Matomo + MongoDB)`,
  run,
}
