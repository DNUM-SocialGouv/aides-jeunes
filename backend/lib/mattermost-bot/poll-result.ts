import mattermost from "./mattermost.js"

function parseCurrentDate() {
  const isoDateTime = new Date(Date.now())
  return `${isoDateTime.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })} à ${isoDateTime.toLocaleTimeString("fr-FR")}`
}

async function postPollResult(simulation, answers) {
  if (answers.length == 0 || !simulation?.benefits) {
    return
  }
  const score = {
    asked: [":icon-valid:", "Demande réussie"],
    failed: [":icon-danger:", "Demande échouée"],
    nothing: [":icon-warning:", "Aucune demande"],
    already: [":icon-info:", "Déjà perçue"],
  }

  const orderedAnswers: any[] = []
  for (const answer of answers) {
    const answerDetails =
      simulation.benefits.filter((benefit) => {
        return answer["id"] == benefit["id"]
      })[0] || {}
    orderedAnswers.push({ ...answerDetails, ...answer })
  }

  const result = [
    `#### Résultat du sondage de suivi d'utilisateur du ${parseCurrentDate()} - [Accéder au suivi](${
      process.env.MES_AIDES_ROOT_URL
    }/accompagnement/${simulation._id})`,
    `${Object.values(score)
      .map((val) => val.join(" "))
      .join("  ")}\n  `,
  ]
  for (const key of orderedAnswers) {
    result.push(
      `${score[key.value] ? score[key.value][0] : ""} [${key.id}](${
        process.env.MES_AIDES_ROOT_URL
      }/aides/${key.id}) ${
        key.unit && typeof key.amount === "number"
          ? `**${Math.round(key.amount * 100) / 100}${key.unit}**`
          : ""
      } ${key.comments?.length > 0 ? `*(${key.comments})*` : ""}`,
    )
  }

  await mattermost.post(result.join("\n"))
}

export default {
  postPollResult,
}
