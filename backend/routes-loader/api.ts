import express from "express"

import dataRoutes from "../routes/data.js"
import emailsRoutes from "../routes/emails.js"
import followupsRoutes from "../routes/followups.js"
import franceConnectRoutes from "../routes/france-connect.js"
import openfiscaRoutes from "../routes/openfisca.js"
import outilsRoutes from "../routes/outils.js"
import proxyRoutes from "../routes/proxy.js"
import simulationRoutes from "../routes/simulation.js"
import legacySmsRoutes from "../routes/legacy-sms.js"
import supportRoutes from "../routes/support.js"
import teleservicesRoutes from "../routes/teleservices.js"
import webhookRoutes from "../routes/webhook.js"
import moncompteproRoutes from "../routes/moncomptepro.js"
import lieuxRoutes from "../routes/lieux.js"
import contributionsRoutes from "../routes/contributions.js"
import statsRoutes from "../routes/stats.js"

const api = express()

dataRoutes(api)
emailsRoutes(api)
followupsRoutes(api)
franceConnectRoutes(api)
moncompteproRoutes(api)
legacySmsRoutes(api)
openfiscaRoutes(api)
outilsRoutes(api)
proxyRoutes(api)
simulationRoutes(api)
supportRoutes(api)
teleservicesRoutes(api)
webhookRoutes(api)
lieuxRoutes(api)
contributionsRoutes(api)
statsRoutes(api)

api.all("*", function (req, res) {
  res.sendStatus(404)
})

export default api
