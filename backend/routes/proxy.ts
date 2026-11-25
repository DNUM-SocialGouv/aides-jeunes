import axios from "axios"
import { Express } from "express"

export default function (api: Express) {
  // Express 4 ne rattrape pas les rejets d'un gestionnaire asynchrone : sans
  // `next`, un jeton absent ou invalide faisait tomber le processus.
  api.route("/proxy/ds").get(async (req, res, next) => {
    const { token } = req.query
    if (typeof token !== "string" || !token) {
      return res.sendStatus(400)
    }
    try {
      const dataURL = `${process.env.MES_AIDES_ROOT_URL}/api/simulation/via/${encodeURIComponent(token)}`
      const dataResponse = await axios.get(dataURL)
      const { data, teleservice } = dataResponse.data

      const postResponse = await axios.post(
        `https://www.demarches-simplifiees.fr/api/public/v1/demarches/${teleservice.id}/dossiers`,
        data,
      )
      const postData = postResponse.data

      res.redirect(postData.dossier_url)
    } catch (error) {
      next(error)
    }
  })
}
