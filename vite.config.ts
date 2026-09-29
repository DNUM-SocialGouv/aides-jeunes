import vue from "@vitejs/plugin-vue"
import legacy from "@vitejs/plugin-legacy"
import { createHtmlPlugin } from "vite-plugin-html"
import { sentryVitePlugin } from "@sentry/vite-plugin"

import path from "path"
import { defineConfig, loadEnv } from "vite"

const __dirname = new URL(".", import.meta.url).pathname

import config from "./backend/config/index.js"
import benefits from "./data/all.js"

import { visualizer } from "rollup-plugin-visualizer"
import generator from "./rollup/generator.rollup.js"
import sitemapGenerator from "./rollup/sitemap.rollup.js"

const buildId = Date.now().toString()

const {
  baseURL,
  contextName,
  contactEmail,
  github,
  matomo,
  netlifyContributionURL,
  statistics,
  franceConnect,
  sentry,
  smsService,
} = config

function createSentryPlugin({ authToken, url, org }, project) {
  if (!authToken || !project) {
    return null
  }
  return sentryVitePlugin({
    org: org || "betagouv",
    project,
    authToken,
    url: url || "https://sentry2.fabrique.social.gouv.fr/",
    sourcemaps: {
      assets: `./dist/assets/${buildId}/js/*.{js,map}`,
    },
  })
}

const benefitCount = benefits.all.filter((benefit) => !benefit.private).length

export default defineConfig(async ({ mode }) => {
  process.env = Object.assign(process.env, loadEnv(mode, process.cwd(), ""))
  const viteEnvironment = {
    VITE_BENEFIT_COUNT: benefitCount,
    VITE_MATOMO_ID: matomo.id,
    VITE_MATOMO_URL: matomo.url,
    VITE_CONTACT_EMAIL: contactEmail,
    VITE_CONTEXT_NAME: contextName,
    VITE_BASE_URL: baseURL,
    VITE_CONTEXT: process.env.NODE_ENV,
    VITE_SENTRY_FRONTEND_DSN: process.env?.SENTRY_FRONTEND_DSN,
    VITE_SENTRY_FRONTEND_PROJECT: process.env?.SENTRY_FRONTEND_PROJECT,
    VITE_PR_URL: `${process.env.REPOSITORY_URL}/pull/${process.env.REVIEW_ID}`,
    VITE_REPOSITORY_URL: github.repository_url,
    VITE_BENEFIT_URL: `${github.repository_url}/blob/main/data/benefits`,
    VITE_NETLIFY_CONTRIBUTION_URL: netlifyContributionURL,
    VITE_STATS_URL: statistics?.url ? statistics.url : "",
    VITE_STATS_VERSION: statistics?.version,
    VITE_NETLIFY_PR: process.env.BRANCH,
    VITE_PIVOT_URL: process.env.PIVOT_URL,
    VITE_1J1S_URL: "https://www.1jeune1solution.gouv.fr",
    VITE_TITLE: `Évaluez vos droits aux aides avec le simulateur de ${contextName}`,
    VITE_DESCRIPTION: `7 minutes suffisent pour évaluer vos droits à ${benefitCount} aides avec le simulateur de ${contextName}.`,
    // For now FranceConnect require an additional query params to be enabled
    VITE_FRANCE_CONNECT_ENABLED: Boolean(franceConnect.clientId),
    VITE_SHOW_SMS_TAB: smsService.show,
    VITE_SMS_DIALLING_CODES: smsService.internationalDiallingCodes,
    VITE_ROBOTS:
      process.env.NODE_ENV === "production"
        ? "index,follow"
        : "noindex,nofollow",
  }

  return {
    server: {
      port: 8080,
      strictPort: true,
    },
    build: {
      manifest: true,
      rollupOptions: {
        plugins: [],
        output: {
          assetFileNames: (assetInfo) => {
            const extension = (assetInfo.name || "").match(/.*\.([a-z0-9]*)$/i)
            if (extension && extension[1]) {
              return `assets/${buildId}/${extension[1]}/[name]-[hash][extname]`
            } else {
              return `assets/${buildId}/other/[name]-[hash][extname]`
            }
          },
          chunkFileNames: () => {
            return `assets/${buildId}/js/[name]-[hash].js`
          },
          entryFileNames: () => {
            return `assets/${buildId}/js/[name]-[hash].js`
          },
        },
      },
      commonjsOptions: {
        exclude: ["lib"],
      },
      emptyOutDir: false,
      sourcemap: true,
    },
    plugins: [
      generator,
      vue(),
      createHtmlPlugin({
        minify: true,
        inject: {
          data: {
            VITE_TITLE: viteEnvironment.VITE_TITLE,
            VITE_DESCRIPTION: viteEnvironment.VITE_DESCRIPTION,
            VITE_BASE_URL: viteEnvironment.VITE_BASE_URL,
            VITE_CONTEXT_NAME: viteEnvironment.VITE_CONTEXT_NAME,
            VITE_ROBOTS: viteEnvironment.VITE_ROBOTS,
          },
        },
      }),
      legacy({
        targets: ["defaults"],
      }),
      visualizer(),
      createSentryPlugin(sentry, viteEnvironment.VITE_SENTRY_FRONTEND_PROJECT),
      sitemapGenerator(),
    ],
    resolve: {
      preferBuiltins: false,
      alias: {
        "@": path.resolve(__dirname, "src"),
        "@lib": path.resolve(__dirname, "lib"),
        "@data": path.resolve(__dirname, "data"),
      },
    },
    define: {
      "process.env": viteEnvironment,
    },
  }
})
