import ABTestingService from "@/plugins/ab-testing-service.js"
import { getEnvVariable } from "@lib/utils.js"
import { StandardBenefit } from "@data/types/benefits.d.js"

import { skipSendStatistics } from "./shared.js"
import tracker from "@/plugins/tracker.js"
import { EventAction } from "@lib/enums/event.js"
import * as Sentry from "@sentry/vue"

const isProduction = process.env.NODE_ENV === "production"

export interface RecorderEvent {
  benefits: StandardBenefit[]
  benefitId?: string
  eventAction: EventAction
}

interface StatisticsRecord {
  benefit_id: string
  hash_id: string
  abtesting: object
  benefit_index: number
  page_total: number
  event_type: EventAction
  version: string
}

function skipSendEventToRecorder(event: RecorderEvent): boolean {
  if (skipSendStatistics()) {
    return true
  }

  try {
    getEnvVariable("VITE_STATS_URL")
    getEnvVariable("VITE_STATS_VERSION")
  } catch (e) {
    console.error("Error: retrieving Vite environment variables" + e)
    return true
  }

  return event.benefits ? event.benefits.length === 0 : true
}

function identifyEvent(): string {
  return tracker.getVisitorId() || `uid_${Math.random().toString(12).slice(2)}`
}

export async function sendEventToRecorder(event: RecorderEvent): Promise<void> {
  if (skipSendEventToRecorder(event)) {
    if (!isProduction) {
      console.debug("Skip sending event to recorder", event)
    }
    return
  }

  const { benefits, benefitId, eventAction } = event
  const abtesting = ABTestingService.getValues()
  const benefitsStats: StatisticsRecord[] = []
  const totalResults = benefits.length
  const eventHashId = identifyEvent()

  benefits.forEach((benefit, i) => {
    if (benefitId && benefitId !== benefit.id) {
      return
    }

    benefitsStats.push({
      benefit_id: benefit.id,
      hash_id: eventHashId,
      abtesting,
      benefit_index: i + 1,
      page_total: totalResults,
      event_type: eventAction,
      version: getEnvVariable("VITE_STATS_VERSION"),
    })
  })

  const url = getEnvVariable("VITE_STATS_URL")

  try {
    new URL(url)
  } catch {
    if (!isProduction) {
      console.debug("VITE_STATS_URL invalide", url)
    } else {
      Sentry.captureException(new Error(`VITE_STATS_URL invalide : ${url}`))
    }
    return
  }

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(benefitsStats),
    })
  } catch {
    // Un échec réseau (offline, bloqueur de pub...) n'a aucun impact utilisateur, inutile de le remonter à Sentry.
    if (!isProduction) {
      console.debug("Event to recorder", event)
    }
  }
}
