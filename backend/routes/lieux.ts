import axios from "axios"
import { Express } from "express"
import config from "../config/index.js"

export default function (api: Express) {
  api.route("/lieux/ccas/:codeCommune").get(async (req, res) => {
    try {
      const { codeCommune } = req.params

      // Verify the data-inclusion token exists at runtime.
      const token = config?.dataInclusion?.token
      if (!token) {
        console.warn(
          "Missing Data Inclusion token: the /lieux/ccas endpoint requires a valid token",
        )
        return res
          .status(503)
          .json({ error: "Service unavailable - missing configuration" })
      }

      const response = await axios.get(
        `${config.dataInclusion.url}/structures`,
        {
          params: {
            sources: "ma-boussole-aidants",
            reseaux_porteurs: "ccas-cias",
            code_commune: codeCommune,
          },
          headers: {
            Authorization: `Bearer ${config.dataInclusion.token}`,
          },
        },
      )

      res.json(response.data)
    } catch (error) {
      console.error("Error fetching CCAS/CIAS structures:", error)
      res.status(500).json({ error: "Failed to fetch structures" })
    }
  })
}
