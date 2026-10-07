<script setup lang="ts">
import { useStore } from "@/stores/index.js"
import { EventAction, EventCategory } from "@lib/enums/event.js"
import StatisticsMixin from "@/mixins/statistics.js"
import { useRoute } from "vue-router"
import { computed, ref } from "vue"
import router from "@/router"
import axios, { AxiosResponse } from "axios"
import * as Sentry from "@sentry/vue"

const store = useStore()
const route = useRoute()
const simulationId = computed(() => store.simulationId)
const saved = ref(false)
const simulationRecapUrl = ref("")

const postRecapFollowup = async () => {
  const uri = `/api/simulation/${simulationId.value}/followup`
  const payload = {
    surveyOptin: false,
  }
  return await axios.post(uri, payload, { headers: store.authHeaders })
}

const saveSimulationAndShowLink = async () => {
  try {
    StatisticsMixin.methods.sendEventToMatomo(
      EventCategory.General,
      EventAction.TemporarySimulationSave,
      route.path,
    )
    store.setSaveSituationError("")
    await store.save()
    const res: AxiosResponse = await postRecapFollowup()
    if (res.data.simulationRecapUrl) {
      simulationRecapUrl.value = res.data.simulationRecapUrl
    }
    saved.value = true
  } catch (error: any) {
    store.setSaveSituationError(error.response?.data || error)
    saved.value = false
    Sentry.captureException(error)
  }
}

const copyTemporarySimulationRecapUrlToClipboard = async () => {
  StatisticsMixin.methods.sendEventToMatomo(
    EventCategory.General,
    EventAction.CopyTemporarySimulationRecapUrlToClipboard,
    route.path,
  )
  await navigator.clipboard.writeText(simulationRecapUrl.value)
  alert("Lien copié dans le presse papier : " + simulationRecapUrl.value)
}

const continueSimulation = () => {
  router.go(-1)
}
</script>

<template>
  <div>
    <p>
      Vous avez un point de blocage ? Il vous manque une information ? Vous
      souhaitez remettre à plus tard la poursuite de votre simulation ?
    </p>
    <p>
      Nous vous proposons de la sauvegarder via un lien d'accès pour la
      reprendre plus tard.
    </p>
    <div v-if="simulationId && saved">
      <div
        class="fr-alert fr-alert--success"
        data-testid="simulation-saved-success-alert"
      >
        <p>Votre simulation a bien été sauvegardée.</p>
      </div>
      <div class="fr-mt-4w">
        <p
          >Ouvrir le récapitulatif dans un nouvel onglet :
          <a
            :href="simulationRecapUrl"
            target="_blank"
            data-testid="simulation-new-tab-access-link"
            title="Accéder au récapitulatif de la simulation - Nouvelle fenêtre"
            >{{ simulationRecapUrl }}
          </a>
        </p>
      </div>
    </div>
    <div class="aj-action-buttons">
      <ul
        class="fr-btns-group fr-btns-group--inline-sm fr-btns-group--inline-reverse fr-mt-4w fr-btns-group--equisized"
      >
        <li>
          <button
            class="fr-btn fr-ml-1w fr-btn--secondary"
            data-testid="pursue-simulation-button"
            @click="continueSimulation"
            >Poursuivre la simulation</button
          >
        </li>
        <li>
          <button
            v-if="!simulationId || !saved"
            class="fr-btn"
            data-testid="temporary-save-simulation-button"
            @click="saveSimulationAndShowLink"
            >Sauvegarder la simulation et afficher le lien
          </button>
        </li>
        <li>
          <button
            v-if="simulationId && saved"
            class="fr-btn share__link fr-share__link--copy"
            title="Copier le lien d'accès à la simulation dans le presse-papier"
            data-testid="simulation-link-clipboard-button"
            @click="copyTemporarySimulationRecapUrlToClipboard()"
            >Copier le lien dans le presse-papier
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
