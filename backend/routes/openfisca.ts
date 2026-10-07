import { check, validationResult } from "express-validator"
import openfisca from "../lib/openfisca/getter.js"
import openfiscaController from "../controllers/openfisca.js"
import benefits from "../../data/all.js"
import { Express } from "express"

let missingBenefits

export default (api: Express) => {
  // Express 4 ne rattrape pas les rejets d'un gestionnaire asynchrone : sans
  // `next`, une indisponibilité d'OpenFisca laisse la requête pendante.
  api.route("/openfisca/missingbenefits").get(async (req, res, next) => {
    if (missingBenefits) {
      res.json(missingBenefits)
      return
    }

    openfisca
      .get("/variables", (payload) => {
        const missingValues = benefits.all
          .filter((benefit) => {
            const source = benefit.openfisca_eligibility_source || benefit.id
            return benefit.source === "openfisca" && !payload[source]
          })
          .map((benefit) => {
            return benefit.id
          })
        res.json(missingValues)
        missingBenefits = missingValues
      })
      .catch(next)
  })

  api
    .route("/openfisca/parameters/:date")
    .get([check("date").isISO8601()], async (req, res, next) => {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).send("Invalid date")
        return
      }

      try {
        const parameters = await openfiscaController.getParametersAsync(
          new Date(req.params.date),
        )
        res.json(parameters)
      } catch (error) {
        next(error)
      }
    })
}
