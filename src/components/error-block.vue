<template>
  <div class="fr-alert fr-alert--error" role="alert">
    <h2 class="fr-text--lead"> Une erreur est survenue. </h2>

    <div v-if="isTimeoutError">
      <p>
        Un grand nombre de personnes utilise ce simulateur en ce moment. Nous
        n'avons pas réussi à répondre à tout le monde en même temps.
      </p>

      <p>
        En actualisant la page vous pourrez obtenir les résultats de votre
        simulation. Si vous le pouvez, attendez quelques minutes pour le faire.
      </p>
    </div>

    <p>
      <a v-analytics="issueTrackingEvent" v-mail="sendErrorMail()"
        >Signalez ce problème</a
      >
      en décrivant ce que vous faisiez avant que cette erreur n'apparaisse, et
      en joignant si possible une capture d'écran. Nous vous répondrons au plus
      vite et corrigerons le problème dès que possible.
    </p>
    <div>
      <button
        class="fr-btn fr-btn--tertiary-no-outline fr-btn--sm fr-mt-2w"
        @click="showDetails = !showDetails"
      >
        {{ showDetails ? "Masquer" : "Afficher" }} les détails techniques
      </button>
    </div>
    <small v-if="showDetails">
      Informations techniques :
      <pre>{{ errorText }}</pre>
    </small>
  </div>
</template>

<script lang="ts">
import { sendError } from "@/plugins/mails.js"
import { useStore } from "@/stores/index.js"
import { useResultsStore } from "@/stores/results.js"
import { EventAction, EventCategory } from "@lib/enums/event.js"
import AlertRevenirPlusTard from "@/components/alert-revenir-plus-tard.vue"

export default {
  name: "ErrorBlock",
  setup() {
    return {
      store: useStore(),
      resultsStore: useResultsStore(),
    }
  },
  data() {
    return {
      alertRevenirPlusTard: AlertRevenirPlusTard,
      showDetails: false,
      issueTrackingEvent: {
        action: EventAction.Support,
        category: EventCategory.Contact,
      },
    }
  },
  computed: {
    errorText() {
      let value = this.resultsStore.error && this.resultsStore.exception
      return value instanceof String || value instanceof Error
        ? value
        : JSON.stringify(value, null, 2)
    },
    isTimeoutError() {
      // `errorText` est une chaîne primitive : `instanceof String` y est faux.
      return (
        typeof this.errorText === "string" && /time.?out/i.test(this.errorText)
      )
    },
    resultats() {
      return this.store.calculs.resultats
    },
  },
  methods: {
    sendErrorMail() {
      return sendError(this.store.simulationId, this.errorText)
    },
  },
}
</script>
