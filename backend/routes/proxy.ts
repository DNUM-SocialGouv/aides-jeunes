import axios from "axios"
import { Express } from "express"
import { asyncHandler } from "../lib/async-handler.js"

export default function (api: Express) {
  api.route("/proxy/ds").get(
    asyncHandler(async (req, res) => {
      const dataURL = `${process.env.MES_AIDES_ROOT_URL}/api/simulation/via/${req.query.token}`
      const dataResponse = await axios.get(dataURL)
      const { data, teleservice } = dataResponse.data

      const postResponse = await axios.post(
        `https://www.demarches-simplifiees.fr/api/public/v1/demarches/${teleservice.id}/dossiers`,
        data,
      )
      const postData = postResponse.data

      res.redirect(postData.dossier_url)
    }),
  )
}
