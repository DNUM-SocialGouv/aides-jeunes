import express from "express"
import * as Sentry from "@sentry/node"
import mongoose from "mongoose"

import configMongoose from "./config/mongoose.js"
import { loadRoutes } from "./routes-loader/index.js"
import config from "./config/index.js"

// Enable Sentry in production
// https://docs.sentry.io/development/sdk-dev/overview/#usage-for-end-users
Sentry.init(config.sentry)

configMongoose(mongoose, config)

export default function (app: express.Application) {
  process.env.PORT = process.env.PORT || "8080"
  // Interface d'écoute, boucle locale par défaut : nginx proxifie sur 127.0.0.1
  // et reste le seul client légitime. Lié à toutes les interfaces, le port est
  // joignable depuis Internet et court-circuite le vhost — les plafonds
  // `limit_req`/`limit_conn` qui protègent le pool OpenFisca, et surtout la
  // réécriture de `X-Forwarded-For` : atteint en direct, le client devient le
  // premier saut, le `trust proxy` = 1 posé plus bas prend son en-tête au mot, et
  // les `rateLimit()` clés sur `req.ip` se contournent en changeant de valeur.
  // Un déploiement qui doit écouter ailleurs — un conteneur — pose HOST.
  process.env.HOST = process.env.HOST || "127.0.0.1"
  process.env.MES_AIDES_ROOT_URL =
    process.env.MES_AIDES_ROOT_URL || `http://localhost:${process.env.PORT}`

  // // The request handler must be the first middleware on the app
  // app.use(Sentry.Handlers.requestHandler())

  loadRoutes(app)

  app.use(express.urlencoded({ extended: true, limit: "1024kb" }))
  // Configure trust proxy with the number of hops instead of 'true'
  // This ensures rate limiting works correctly
  app.set("trust proxy", 1)

  // The error handler must be before any other error middleware and after all controllers
  Sentry.setupExpressErrorHandler(app)
}
