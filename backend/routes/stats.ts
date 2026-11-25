import cors from "cors"
import { Express } from "express"
import { mapStats } from "../controllers/stats.js"

export default function statsRoutes(api: Express) {
  api.route("/stats/map").get(cors({ origin: "*" }), mapStats)
}
