// Source : base MongoDB de production (en lecture seule), collection simulations.
// À l'anonymisation (tools/cleaner.ts), la date de naissance du demandeur est
// remplacée par son âge (réponse "age") : seules les simulations anonymisées
// sont donc prises en compte.
import { MongoClient } from "mongodb"

import { SimulationStatus } from "../../lib/enums/simulation.js"
import { PRODUCTION_MONGODB_URL, withSshTunnel } from "./ssh-tunnel.js"

// Âge médian à partir du nombre de simulations par âge, triés par âge
function median(counts: { age: number; simulations: number }[]) {
  const total = counts.reduce((sum, { simulations }) => sum + simulations, 0)
  let cumulated = 0
  for (const { age, simulations } of counts) {
    cumulated += simulations
    if (cumulated >= total / 2) {
      return age
    }
  }
}

async function averageAgeByYear() {
  const client = await MongoClient.connect(PRODUCTION_MONGODB_URL)
  try {
    const years = await client
      .db()
      .collection("simulations")
      .aggregate([
        {
          $match: {
            status: SimulationStatus.Anonymized,
            finishedAt: { $exists: true },
          },
        },
        { $unwind: "$answers.all" },
        {
          $match: {
            "answers.all.entityName": "individu",
            "answers.all.id": "demandeur",
            "answers.all.fieldName": "age",
          },
        },
        {
          $group: {
            _id: { year: { $year: "$finishedAt" }, age: "$answers.all.value" },
            simulations: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.age": 1 } },
        {
          $group: {
            _id: "$_id.year",
            counts: { $push: { age: "$_id.age", simulations: "$simulations" } },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray()

    console.log(
      "| Année | Âge moyen | Âge médian | Simulations |\n|---|---:|---:|---:|",
    )
    for (const { _id, counts } of years) {
      const simulations = counts.reduce(
        (sum, count) => sum + count.simulations,
        0,
      )
      const average =
        counts.reduce((sum, count) => sum + count.age * count.simulations, 0) /
        simulations
      console.log(
        `| ${_id} | ${average.toFixed(1)} ans | ${median(counts)} ans | ${simulations} |`,
      )
    }
  } finally {
    await client.close()
  }
}

export default {
  label: "Âge moyen et médian des demandeurs par année (MongoDB)",
  run: () => withSshTunnel(averageAgeByYear),
}
