// Source : base MongoDB de production (en lecture seule), collection simulations,
// via un tunnel SSH ouvert et refermé automatiquement (voir ssh-tunnel.ts).
// Compte les simulations dont une réponse de commune est Vannes.
import { MongoClient } from "mongodb"

import { PRODUCTION_MONGODB_URL, withSshTunnel } from "./ssh-tunnel.js"

async function countSimulationsByYear() {
  const client = await MongoClient.connect(PRODUCTION_MONGODB_URL)
  try {
    const years = await client
      .db()
      .collection("simulations")
      .aggregate([
        {
          $match: { "answers.all.value._nomCommune": "Vannes" },
        },
        { $group: { _id: { $year: "$createdAt" }, simulations: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ])
      .toArray()

    console.log("| Année | Simulations |\n|---|---:|")
    for (const { _id, simulations } of years) {
      console.log(`| ${_id} | ${simulations} |`)
    }
  } finally {
    await client.close()
  }
}

export default {
  label: "Ville de Vannes : nombre de simulations par année (MongoDB)",
  run: () => withSshTunnel(countSimulationsByYear),
}
