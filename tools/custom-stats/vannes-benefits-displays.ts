// Source : base MongoDB de production db_stats_recorder (en lecture seule),
// collection records, alimentée par aides-jeunes-stats-recorder : un document
// par dispositif affiché dans une page de résultats (sans la troncature de Matomo).
import { MongoClient } from "mongodb"

import Benefits from "../../data/all.js"
import { PRODUCTION_MONGODB_URL, withSshTunnel } from "./ssh-tunnel.js"

const INSTITUTION = "ville-de-vannes"

async function countDisplays() {
  const benefitIds = Benefits.all
    .filter((benefit) => benefit.institution?.slug === INSTITUTION)
    .map((benefit) => benefit.id)

  const client = await MongoClient.connect(PRODUCTION_MONGODB_URL)
  try {
    const benefits = await client
      .db("db_stats_recorder")
      .collection("records")
      .aggregate([
        {
          $match: {
            event_type: "show",
            created_at: {
              $gte: new Date("2026-01-01"),
              $lt: new Date("2027-01-01"),
            },
            benefit_id: { $in: benefitIds },
          },
        },
        { $group: { _id: "$benefit_id", displays: { $sum: 1 } } },
        { $sort: { displays: -1 } },
      ])
      .toArray()

    console.log("| Dispositif | Affichages |\n|---|---:|")
    for (const { _id, displays } of benefits) {
      console.log(`| ${_id} | ${displays} |`)
    }
    const total = benefits.reduce((sum, { displays }) => sum + displays, 0)
    console.log(`| **Total** | **${total}** |`)
  } finally {
    await client.close()
  }
}

export default {
  label:
    "Ville de Vannes : affichages des dispositifs de la ville en 2026 (MongoDB)",
  run: () => withSshTunnel(countDisplays),
}
