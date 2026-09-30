import "dotenv/config"

import { Configuration } from "../types/config.js"

const isProduction = process.env.NODE_ENV == "production"
/**
 * NOTE: Les variables d'environement suivantes
 * Sont défini directement par pm2 en production
 * et ne sont donc pas dans les .env sur le serveur
 * - NODE_ENV
 * - MONGODB_URL
 * - PORT
 * - MES_AIDES_ROOT_URL
 * - OPENFISCA_INTERNAL_ROOT_URL
 * - OPENFISCA_PUBLIC_ROOT_URL
 */

const contextName = process.env.CONTEXT_NAME || "1jeune1solution"

const config: Configuration = {
  env: process.env.NODE_ENV || "development",
  baseURL:
    process.env.MES_AIDES_ROOT_URL ||
    process.env.DEPLOY_URL || // Netlify deploy apps
    "http://localhost:8080",
  accompagnement: {
    path: "/accompagnement",
    unauthorizedPath: "/accompagnement?unauthorized",
    errorPath: "/accompagnement?error",
  },
  aideJeuneExperimentationURL: isProduction
    ? "https://betagouv.github.io/aides-jeunes-experimentations"
    : "http://127.0.0.1:3000",
  contactEmail: process.env.EMAIL_CONTACT || "aides-jeunes@beta.gouv.fr",
  contextName,
  franceConnect: {
    root: process.env.FRANCE_CONNECT_ROOT_URL,
    clientId: process.env.FRANCE_CONNECT_CLIENT_ID,
    clientSecret: process.env.FRANCE_CONNECT_CLIENT_SECRET,
    mesriEndpoint: process.env.FRANCE_CONNECT_MESRI_ENDPOINT,
    scopes: [
      "birthdate",
      "email",
      "mesri_inscription_etudiant",
      "mesri_inscription_autre",
      "mesri_admission",
      "mesri_etablissements",
    ].join(" "),
  },
  openfiscaURL:
    process.env.OPENFISCA_INTERNAL_ROOT_URL || "http://127.0.0.1:2000",
  // Doit rester inférieur au `timeout` gunicorn d'OpenFisca (openfisca/config.py) :
  // abandonner côté client ne libère pas le worker, c'est gunicorn qui le recycle.
  openfiscaTimeout: Number(process.env.OPENFISCA_TIMEOUT_MS) || 25000,
  // Le tracé d'une variable sur un axe empile 141 situations dans une seule
  // requête : mesuré à 12 s sur un poste de développement, il dépasse les 25 s
  // sur une machine de CI. Même contrainte vis-à-vis de gunicorn.
  openfiscaBulkTimeout: Number(process.env.OPENFISCA_BULK_TIMEOUT_MS) || 60000,
  openfiscaAxeURL: isProduction
    ? "https://betagouv.github.io/mes-aides-changent"
    : "http://127.0.0.1:3000",
  openfiscaPublicURL:
    process.env.OPENFISCA_PUBLIC_ROOT_URL || "http://127.0.0.1:2000",
  openfiscaTracerURL: isProduction
    ? "https://openfisca.github.io/tracer/"
    : "http://127.0.0.1:3000",
  netlifyContributionURL:
    process.env.NETLIFY_CONTRIBUTION_URL ||
    "https://contribuer-aides-jeunes.netlify.app",
  rdvAideNumerique: {
    sharedSecret: process.env.RDV_AIDE_NUMERIQUE_SHARED_SECRET || "",
    baseUrl: process.env.RDV_AIDE_NUMERIQUE_BASE_URL || "",
  },
  smtp: {
    host: process.env.SMTP_HOST || "localhost",
    port: process.env.SMTP_PORT || "7777",
    requireTLS: process.env.SMTP_REQUIRE_TLS !== "false",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  },
  github: {
    repository_url: "https://github.com/DNUM-SocialGouv/aides-jeunes",
  },
  matomo: {
    id: Number(process.env.MATOMO_ID) || 66,
    url: process.env.MATOMO_URL || "https://stats.beta.gouv.fr",
  },
  moncomptepro: {
    authorized_email_users:
      process.env.NODE_ENV === "production"
        ? [
            "jeremy.pastouret@beta.gouv.fr",
            "simon.hamery@beta.gouv.fr",
            "juliette.dixmier@beta.gouv.fr",
          ]
        : ["user@yopmail.com"],
    client_id:
      process.env.MCP_CLIENT_ID ||
      "bluSy6KBAl0lMu3I5yD2sYeF90KaOZQEyvYBQNCMq5ohZ40VrMtx23dOPNYDj6Sej0wUE7qGni8g8QtNKstB3sxWbJSWBpfOqnl03AK7bqI0BlNWmw9Vdepy6GFXeVPL",
    client_secret:
      process.env.MCP_CLIENT_SECRET ||
      "dB7BjWZaekMgzvJ70vpoTK276VOvyZQzkyGayEMtJZfP2DH7nYZU5lzsKjWaoVjLGNG1RATfXyqoStzLBumkwO8SyZIOJZMdR5OVKmkiSLpijjyv0W7s2QVNwafzyCWs",
    provider:
      process.env.MCP_PROVIDER ||
      "https://identite-sandbox.proconnect.gouv.fr/",
    redirect_uri:
      process.env.MCP_REDIRECT_URI || "http://localhost:8080/api/auth/redirect",
    scope: process.env.MCP_SCOPE || "openid email profile",
  },
  statistics: {
    url: process.env.VITE_STATS_URL || "http://localhost:4000/benefits",
    version: Number(process.env.VITE_STATS_VERSION) || 2,
  },
  mongodb_url:
    process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/dev-aides-jeunes",
  sentry: {
    org: process.env.SENTRY_ORG,
    url: process.env.SENTRY_URL,
    dsn: process.env.SENTRY_BACKEND_DSN,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    project: process.env.SENTRY_BACKEND_PROJECT,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    profilesSampleRate: 1.0,
    debug: "development" === process.env.NODE_ENV,
  },
  sessionSecret: process.env.SESSION_SECRET || "fghjdfjkdf785a-jreu",
  mattermost_post_url: process.env.MATTERMOST_POST_URL || "",
  teleserviceAccessTokens: {
    PNDS: process.env.PNDS_TOKEN || "token",
  },
  iframeTitle: `Évaluez vos droits aux aides avec le simulateur de ${contextName}`,
  smsService: {
    show: process.env.SMS_SERVICE_SHOW !== "false",
    username: process.env.SMS_SERVICE_USERNAME || "",
    password: process.env.SMS_SERVICE_PASSWORD || "",
    url: "https://europe.ipx.com/restapi/v1/sms/send",
    internationalDiallingCodes: ["33", "262", "508", "590", "594", "596"],
  },
  dataInclusion: {
    url: "https://api.data.inclusion.gouv.fr/api/v1",
    token: process.env.DATA_INCLUSION_TOKEN || "",
  },
}

export default Object.freeze(config)
