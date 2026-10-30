// Source : Matomo, sommé mois par mois :
// - simulations terminées : objectif n°1 « Simulation terminée »
// - affichages et consultations : événements "show" et "showDetails" de chaque dispositif
// Source : MongoDB de production, collection followups : réponses au sondage
// envoyé à J+7 (type benefit-action) reçues en 2026
import { MongoClient } from "mongodb"

import { SurveyType } from "../../lib/enums/survey.js"
import { callMatomo, monthsOf } from "./matomo.js"
import { PRODUCTION_MONGODB_URL, withSshTunnel } from "./ssh-tunnel.js"

const BENEFITS = {
  css_participation_forfaitaire: "CSS",
  aide_logement: "Aide au logement",
  ppa: "Prime d'activité",
  rsa: "RSA",
  bourse_criteres_sociaux: "Bourse sur critères sociaux",
  aah: "AAH",
}

// Réponses possibles au sondage, cf. src/views/suivi.vue
const SURVEY_ANSWERS = {
  asked: "J'ai réussi à faire la démarche",
  already: "J'en bénéficiais déjà",
  failed: "Je n'ai pas réussi à faire la démarche",
  nothing: "Je n'ai rien fait",
}

// { [dispositif]: { [réponse]: nombre } }
async function countSurveyAnswers() {
  const client = await MongoClient.connect(PRODUCTION_MONGODB_URL)
  try {
    const counts = await client
      .db()
      .collection("followups")
      .aggregate([
        { $match: { "surveys.type": SurveyType.BenefitAction } },
        { $unwind: "$surveys" },
        {
          $match: {
            "surveys.type": SurveyType.BenefitAction,
            "surveys.repliedAt": {
              $gte: new Date("2026-01-01"),
              $lt: new Date("2027-01-01"),
            },
          },
        },
        { $unwind: "$surveys.answers" },
        { $match: { "surveys.answers.id": { $in: Object.keys(BENEFITS) } } },
        {
          $group: {
            _id: {
              id: "$surveys.answers.id",
              value: "$surveys.answers.value",
            },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray()
    const result = {}
    for (const { _id, count } of counts) {
      result[_id.id] = { ...result[_id.id], [_id.value]: count }
    }
    return result
  } finally {
    await client.close()
  }
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
  let surveys = {}
  await withSshTunnel(async () => {
    surveys = await countSurveyAnswers()
  })
  const respondents = Object.keys(BENEFITS).map((id) =>
    Object.values(surveys[id] || {}).reduce(
      (sum: number, count: number) => sum + count,
      0,
    ),
  ) as number[]

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
      row("Répondants au sondage J+7 (2026)", respondents.map(String)),
      ...Object.entries(SURVEY_ANSWERS).map(([value, label]) =>
        row(
          `**${label}**`,
          Object.keys(BENEFITS).map((id, index) => {
            const count = surveys[id]?.[value] || 0
            return `${count} (${((100 * count) / respondents[index]).toFixed(1)} %)`
          }),
        ),
      ),
    ].join("\n"),
  )
}

export default {
  label:
    "CSS, aide au logement, prime d'activité, RSA, bourse, AAH : affichages, consultations et sondage J+7 en 2026 (Matomo + MongoDB)",
  run,
}
