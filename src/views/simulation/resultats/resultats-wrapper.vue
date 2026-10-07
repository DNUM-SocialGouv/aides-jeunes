<script setup lang="ts">
import LoadingModal from "@/components/loading-modal.vue"
import BackButton from "@/components/buttons/back-button.vue"
import StatisticsMixin from "@/mixins/statistics.js"
import { useStore } from "@/stores/index.js"
import { useResultsStore } from "@/stores/results.js"
import { daysSinceDate } from "@lib/utils.js"
import { EventAction, EventCategory } from "@lib/enums/event.js"
import Simulation from "@/lib/simulation.js"
import MockResults from "@/lib/mock-results"
import { fieldsToAnswerAgain, isUnusableAnswer } from "@lib/simulation.js"
import { getStepAnswer } from "@lib/answers.js"
import { computed, onMounted, onBeforeUnmount, ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import * as Sentry from "@sentry/vue"

const resultsStore = useResultsStore()
const store = useStore()
const router = useRouter()
const route = useRoute()
const benefits = computed(() => resultsStore.benefits)
const fetching = computed(() => resultsStore.fetching)
const updating = computed(() => resultsStore.updating)
const stopSubscription = ref<(() => void) | null>(null)
const showBackButton = computed(() => {
  return (
    router.currentRoute.value.meta?.showBackToResultsButton &&
    router.currentRoute.value.name !== "resultats"
  )
})

onMounted(async () => {
  initializeStore()
  handleLegacySituationId()
  if (MockResults.mockResultsNeeded()) {
    MockResults.mock(route.params.benefitId)
    return
  }
  // Simulation déjà chargée — lien de relance, retour dans le parcours. La
  // garde ne s'applique pas quand l'adresse en réclame une autre : le magasin
  // porterait alors la précédente.
  if (!route.query?.simulationId && askUnusableAnswerAgain()) {
    return
  }
  if (route.query?.simulationId) {
    await handleSimulationIdQuery()
  } else if (!store.passSanityCheck) {
    await restoreLatestSimulation()
  } else if (store.calculs.dirty) {
    await saveSimulation()
  } else if (!store.hasResults) {
    if (store.simulation.teleservice) {
      await redirectToTeleservice()
    } else {
      store.computeResults()
    }
  }
})

// Une réponse manquante ou perdue rend son étape à nouveau sans réponse.
// Afficher les résultats sans elle ferait disparaître le droit qui en dépend
// — plus de mille euros d'AAH par mois — sur une page d'apparence complète. La
// question est donc reposée, et le calcul n'est même pas lancé.
//
// Le renvoi vise ces seules réponses, et pas toute étape sans réponse : une
// question ajoutée après coup en laisse aussi dans les anciennes simulations,
// et renvoyer celles-là dans le parcours les priverait de leurs résultats.
// L'étape est cherchée nommément, et non via la première étape sans réponse,
// qu'un manque sans rapport suffirait à masquer.
//
// La valeur est examinée, pas seulement la présence de la réponse : une
// simulation née après la migration v18 n'en bénéficie pas et porterait sa
// valeur perdue jusqu'à OpenFisca, qui refuserait la requête entière.
const askUnusableAnswerAgain = (): boolean => {
  if (store.simulationAnonymized || !store.passSanityCheck) {
    return false
  }
  const step = store.getAllSteps.find(
    (step) =>
      fieldsToAnswerAgain.includes(step.variable) &&
      step.isActive &&
      isUnusableAnswer(getStepAnswer(store.simulation.answers.all, step)),
  )
  if (!step) {
    return false
  }
  router.replace(step.path)
  return true
}

// Le chargement est séparé du calcul : lancer un calcul OpenFisca complet pour
// une page qui ne sera jamais affichée pèse sur le service même dont la
// saturation est en cause.
const restoreLatestSimulation = async () => {
  // Sans identifiant en cookie, la restauration renvoie vers l'accueil sans
  // rien charger. `simulationId` peut pourtant survivre de la session
  // précédente : s'y fier lancerait un calcul sur une page déjà quittée.
  const restoredId = Simulation.getLatestId()
  await Simulation.restoreLatestSimulationWithoutResultsComputing()
  if (!restoredId || !store.simulationId || store.simulationAnonymized) {
    return
  }
  if (askUnusableAnswerAgain()) {
    return
  }
  store.computeResults()
}

onBeforeUnmount(() => {
  stopSubscription.value?.()
})

const sendShowStatistics = () => {
  StatisticsMixin.methods.sendBenefitsStatistics(
    benefits.value,
    EventAction.Show,
  )
}
const sendDisplayUnexpectedAmountLinkStatistics = () => {
  const benefitsWithUnexpectedAmount = benefits.value.filter((benefit) => {
    const unexpectedAmountLinkDisplayed =
      (benefit.isBaseRessourcesYearMinusTwo &&
        !store.ressourcesYearMinusTwoCaptured) ||
      benefit.showUnexpectedAmount

    return unexpectedAmountLinkDisplayed
  })

  StatisticsMixin.methods.sendBenefitsStatistics(
    benefitsWithUnexpectedAmount,
    EventAction.ShowUnexpectedAmountLink,
  )
}

const sendAccessToAnonymizedResults = () => {
  StatisticsMixin.methods.sendEventToMatomo(
    EventCategory.General,
    EventAction.AccesSimulationAnonymisee,
    daysSinceDate(new Date(store.simulation.dateDeValeur)).toString(),
  )
}
const initializeStore = () => {
  store.updateCurrentAnswers(route.path)

  stopSubscription.value = store.$onAction(({ after, name }) => {
    after(() => {
      switch (name) {
        case "setResults": {
          sendShowStatistics()
          sendDisplayUnexpectedAmountLinkStatistics()
          break
        }
        case "saveComputationFailure": {
          StatisticsMixin.methods.sendEventToMatomo(
            EventCategory.General,
            EventAction.ErreurInitStore,
            route.path,
          )
          break
        }
      }
    })
  })
}
const handleLegacySituationId = () => {
  // Used for old links containing situationId instead of simulationId
  if (route.query?.situationId) {
    store.setSimulationId(route.query.situationId.toString())
  }
}
const handleSimulationIdQuery = async () => {
  if (store.simulationId === route.query.simulationId && store.hasResults) {
    return
  }

  if (route.query.simulationId) {
    await store.fetch(route.query.simulationId.toString())
  }

  if (store.simulationAnonymized) {
    sendAccessToAnonymizedResults()
    await store.retrieveResultsAlreadyComputed()
  } else {
    // La question est reposée avant tout calcul, et l'adresse n'est pas
    // réécrite : le renvoi vers l'étape a déjà eu lieu.
    if (askUnusableAnswerAgain()) {
      return
    }
    store.computeResults()
  }

  router.replace({ ...router.currentRoute.value, simulationId: null } as any)
}
const saveSimulation = async () => {
  try {
    store.setSaveSituationError("")
    await store.save()

    if (!store.access.forbidden) {
      store.computeResults()
    }
  } catch (error: any) {
    store.setSaveSituationError(error.response?.data || error)
    StatisticsMixin.methods.sendEventToMatomo(
      EventCategory.General,
      EventAction.ErreurSauvegardeSimulation,
      route.path,
    )
    Sentry.captureException(error)
  }
}
const redirectToTeleservice = async () => {
  if (store.simulationId) {
    const representation = await store.fetchRepresentation(
      store.simulation.teleservice,
      store.simulationId,
    )

    window.location.href = representation.destination.url
  }
}
</script>

<template>
  <div>
    <LoadingModal v-if="fetching || updating">
      <p>Récupération en cours…</p>
    </LoadingModal>
    <BackButton
      v-if="showBackButton"
      class="fr-btn--secondary fr-btn--sm fr-mb-2w"
      data-testid="back-button"
      fallback="/simulation/resultats"
    >
      Retour aux résultats
    </BackButton>
    <RouterView />
  </div>
</template>
