export interface Configuration {
  env: string
  baseURL: string
  contactEmail: string
  contextName: string
  accompagnement: {
    path: string
    unauthorizedPath: string
    errorPath: string
  }
  aideJeuneExperimentationURL: string
  franceConnect: {
    root?: string
    clientId?: string
    clientSecret?: string
    mesriEndpoint?: string
    scopes: string
  }
  openfiscaURL: string
  openfiscaTimeout: number
  openfiscaBulkTimeout: number
  openfiscaAxeURL: string
  openfiscaPublicURL: string
  openfiscaTracerURL: string
  netlifyContributionURL: string
  smtp: {
    host: string
    port: string | number
    requireTLS: boolean
    auth: {
      user: string | undefined
      pass: string | undefined
    }
  }
  rdvAideNumerique: {
    sharedSecret: string
    baseUrl: string
  }
  github: {
    repository_url: string
  }
  matomo: {
    id: number
    url: string
  }
  moncomptepro: {
    authorized_email_users: string[]
    client_id: string
    client_secret: string
    provider: string
    redirect_uri: string
    scope: string
  }
  statistics: {
    url: string
    version: number
  }
  mongodb_url: string
  sessionSecret: string
  mattermost_post_url: string
  teleserviceAccessTokens: {
    PNDS: string
  }
  iframeTitle: string
  sentry: {
    dsn?: string
    authToken?: string
    project?: string
    environment?: string
    tracesSampleRate: float
    profilesSampleRate: float
    debug: boolean
    org?: string
    url?: string
  }
  smsService: {
    show: boolean | undefined
    username: string
    password: string
    url: string
    internationalDiallingCodes: string[]
  }
  dataInclusion: {
    url: string
    token: string
  }
}
