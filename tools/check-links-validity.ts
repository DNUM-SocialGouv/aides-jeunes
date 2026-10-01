import Benefits from "../data/all.js"
import {
  determineExistingWarningsFixByPrivateBenefits,
  determineOperationsOnBenefitLinkError,
} from "../lib/benefits/link-validity.js"
import {
  GristData,
  GristLinkValidityResponse,
} from "../lib/types/link-validity.js"
import { Grist } from "../lib/grist.js"
import Mattermost from "../backend/lib/mattermost-bot/mattermost.js"
import { formatRejection } from "../backend/lib/process-error-handlers.js"
import { ErrorName } from "../lib/enums/error.js"

import axios from "axios"
import https from "https"
import Bluebird from "bluebird"
import * as Sentry from "@sentry/node"

const DEFAULT_BRANCH_REF = "refs/heads/main"

// Avoid some errors due to bad tls management
const httpsAgent = new https.Agent({ rejectUnauthorized: false })

async function checkBenefitUrls(benefit) {
  const results = await Bluebird.map(benefit.links, fetchStatus)
  console.log(
    `${benefit.label} (${benefit.institution})\n${results
      .map((e) => (e.ok ? `- ✅ ${e.type}` : `- ❌ ${e.type} ${e.link}`))
      .join("\n")}`,
  )
  return benefit
}

async function fetchStatus(ressource) {
  ressource.status = await getHTTPStatus(ressource.link)

  // Retry one time in case of timeout
  if (ressource.status === 499) {
    await sleep(10000)
    ressource.status = await getHTTPStatus(ressource.link)
  }
  ressource.ok = ressource.status === 200
  return ressource
}

async function getHTTPStatus(link) {
  try {
    const res = await axios.get(link, {
      timeout: 15000,
      withCredentials: true,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:99.0) Gecko/20100101 Firefox/99.0",
        Referer: "https://mes-aides.1jeune1solution.beta.gouv.fr/",
        TE: "trailers",
        "Upgrade-Insecure-Requests": 1,
        "Sec-Fetch-Mode": "navigate",
        "Sec-GPC": "1",
        "Sec-Fetch-User": "?1",
        "Sec-Fetch-Dest": "document",
      },
      httpsAgent,
    })
    return res.status
  } catch (err: any) {
    return err.response?.status || 499
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function getPriorityStats() {
  const matomoURL =
    "https://stats.beta.gouv.fr/index.php?module=API&format=JSON&idSite=63&period=range&date=previous30&method=Events.getName&filter_limit=-1"
  const stats = await axios.get(matomoURL).then((response) => response.data)

  return stats.reduce((priorityMap, statItem) => {
    const benefitId: string = statItem.label
    const priority: number = statItem.nb_visits

    if (priority) {
      priorityMap[benefitId] = priority
    }

    return priorityMap
  }, {})
}

function filterPublicBenefits(benefits) {
  return benefits.filter((benefit) => !benefit.private)
}

export function filterPrivateBenefits(benefits) {
  return benefits.filter((benefit) => benefit.private)
}

async function getBenefitData(noPriority: boolean) {
  let priorityMap = {}
  try {
    priorityMap = noPriority ? {} : await getPriorityStats()
  } catch (error) {
    console.error(error)
    Sentry.captureException(error)
    console.warn("Unable to get priority stats, priorityMap is empty")
  }
  const publicBenefits = filterPublicBenefits(Benefits.all)
  const data = publicBenefits.map((benefit) => {
    const linkMap = ["link", "instructions", "form", "teleservice"]
      .filter(
        (linkType) =>
          benefit[linkType] && typeof benefit[linkType] === "string",
      )
      .reduce((a, linkType) => {
        const link = benefit[linkType]
        a[link] = a[link] || { link, types: [] }
        a[link].types.push(linkType)

        return a
      }, {})

    const links = Object.values(linkMap).map((v: any) => {
      return {
        link: v.link,
        type: v.types.join(" / "),
      }
    })

    return {
      id: benefit.id,
      label: benefit.label,
      institution: benefit.institution.label,
      priority: priorityMap[benefit.id] || 0,
      links,
    }
  })
  return data.sort((a, b) => +(a.priority - b.priority))
}

const dryRun = process.argv.includes("--dry-run")
const noPriority = process.argv.includes("--no-priority")
const benefitIdsFromCLI = getBenefitIdsFromCLI()
const pullRequestURL = determinePullRequestURL()
const processingPR = Boolean(pullRequestURL)

function getBenefitIdsFromCLI(): string[] | undefined {
  if (process.argv.includes("--only")) {
    return process.argv.slice(process.argv.indexOf("--only") + 1)
  }
}

function determinePullRequestURL() {
  if (
    !process.env.GITHUB_REF ||
    process.env.GITHUB_REF === DEFAULT_BRANCH_REF
  ) {
    return
  }
  const { GITHUB_REF, GITHUB_REPOSITORY, GITHUB_SERVER_URL } = process.env

  console.log("determinePullRequestURL", { GITHUB_REF })

  const pullRequestNumber = GITHUB_REF.match(
    /(?:refs\/pull\/)(?<number>[\d]+)\/merge/,
  )?.groups?.number
  return `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/pull/${pullRequestNumber}`
}

function filterBenefitDataToProcess(
  benefitData,
  ...benefitLimitations: (string[] | undefined)[]
) {
  let subset = benefitData
  benefitLimitations.forEach((ids) => {
    if (!ids) {
      return
    }
    subset = subset.filter((benefit) => ids.includes(benefit.id))
  })
  return subset
}

async function main() {
  if (!process.env.GRIST_DOC_ID) {
    throw new Error("Missing GRIST_DOC_ID")
  }
  if (!process.env.GRIST_API_KEY) {
    throw new Error("Missing GRIST_API_KEY")
  }
  const gristAPI = Grist(process.env.GRIST_DOC_ID, process.env.GRIST_API_KEY)

  const user = await gristAPI.getConnectedUser()
  console.log(`Connected as ${user.name}.`)

  const rawExistingWarnings = (await gristAPI.get({
    Corrige: [false],
    Aide: benefitIdsFromCLI,
    Traite: [false],
  })) as GristLinkValidityResponse

  const benefitData = await getBenefitData(noPriority)
  const benefitsToAnalyze = filterBenefitDataToProcess(
    benefitData,
    benefitIdsFromCLI,
    processingPR
      ? rawExistingWarnings.records.map((r) => r.fields.Aide)
      : undefined,
  )

  const existingWarnings = rawExistingWarnings.records.reduce((a, record) => {
    const fields = record.fields
    a[fields.Aide] = a[fields.Aide] || {}
    a[fields.Aide][fields.Type] = record
    return a
  }, {})

  const benefitLinksCheckResults = await Bluebird.map(
    benefitsToAnalyze,
    checkBenefitUrls,
    {
      concurrency: 3,
    },
  )

  const benefitOperationsList = benefitLinksCheckResults.map(
    (benefitLinksCheckResult) =>
      determineOperationsOnBenefitLinkError(
        existingWarnings,
        benefitLinksCheckResult,
        pullRequestURL,
      ),
  )

  const privateBenefits = filterPrivateBenefits(Benefits.all)
  determineExistingWarningsFixByPrivateBenefits(
    existingWarnings,
    privateBenefits,
    benefitOperationsList,
    pullRequestURL,
  )

  type RecordsByOperationTypesType = { [operationType: string]: GristData[] }
  const recordsByOperationTypes: RecordsByOperationTypesType = {
    add: [],
    update: [],
  }

  benefitOperationsList.forEach((operations) => {
    operations.forEach(({ type, data }) => {
      recordsByOperationTypes[type].push(data)
    })
  })

  console.log("== recordsByOperationTypes ==")
  console.log(JSON.stringify(recordsByOperationTypes, null, 2))
  if (!dryRun) {
    try {
      if (recordsByOperationTypes.add.length) {
        await gristAPI.add(recordsByOperationTypes.add)
      }
      if (recordsByOperationTypes.update.length) {
        await gristAPI.update(recordsByOperationTypes.update)
      }
    } catch (e) {
      console.log(e)
    }
  }
  console.log("Terminé")

  // Notify on mattermost
  const invalidLinksAdded = recordsByOperationTypes.add.length > 0

  if (invalidLinksAdded && !dryRun && !processingPR) {
    const text = [
      `:icon-info: La liste des aides avec des liens invalides a été mise à jour ici : [lien](https://grist.numerique.gouv.fr/o/aides-jeunes/${process.env.GRIST_DOC_ID}/Veille/p/39)`,
      `Ajout: ${recordsByOperationTypes.add.length}`,
      `Mise à jour: ${recordsByOperationTypes.update.length}`,
    ].join("\n")
    // La mise à jour Grist est déjà tentée à ce stade : une notification qui
    // n'aboutit pas ne doit pas emporter le compte rendu de l'outil. Ce module
    // n'installe aucun écouteur `unhandledRejection`, donc un rejet laissé
    // libre arrêterait le programme après coup.
    try {
      await Mattermost.post(text, process.env.MATTERMOST_ALERTING_URL)
    } catch (error: any) {
      // Résumé plat, jamais l'objet brut ici : une erreur axios porte l'URL
      // appelée dans `path`, `pathname` et `_header`, et le journal d'Actions
      // est public. Le masquage de GitHub ne couvre que la valeur exacte du
      // secret, pas ses fragments.
      console.error("Notification Mattermost", formatRejection(error))
      // Une URL absente ne se répare pas en réessayant : la veille resterait
      // muette sans que rien ne le dise. Seul ce cas fait échouer le compte
      // rendu ; une panne passagère du service, non — au prix, assumé, de
      // l'alerte de cette nuit-là : un lien déjà consigné dans Grist ne
      // produit plus d'`add` les nuits suivantes, donc plus de notification.
      if (error?.name === ErrorName.MattermostNotConfiguredError) {
        process.exitCode = 1
      }
    }
  }
}

main()
