import Common from "../backend/lib/openfisca/mapping/common.js"
import OpenfiscaGetter from "../backend/lib/openfisca/getter.js"
import assert from "assert"

const openfiscaPeriodToDefinitionPeriod = {
  thisMonth: "MONTH",
  thisYear: "YEAR",
  fiscalYear: "YEAR",
}

const openfiscaPromise: Array<Promise<void>> = []
Object.keys(Common.requestedVariables).forEach((variableId) => {
  openfiscaPromise.push(
    OpenfiscaGetter.get(`/variable/${variableId}`, (data) => {
      const definitionPeriod =
        openfiscaPeriodToDefinitionPeriod[
          Common.requestedVariables[variableId].openfiscaPeriod
        ]
      assert(definitionPeriod === data.definitionPeriod)
    }),
  )
})

Promise.all(openfiscaPromise).then(() => console.log("Test done"))
