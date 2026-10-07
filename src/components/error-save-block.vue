<template>
  <div class="fr-alert fr-alert--error" role="alert">
    <h2 class="fr-text--lead"> Une erreur est survenue. </h2>
    <p>
      <a
        v-analytics="issueTrackingEvent"
        v-mail="{
          subject: `[Erreur Back] Problème technique`,
          body: `Bonjour,
  J'ai tenté de XXX,
  Et en cliquant sur XXX,
  J'ai rencontré l'erreur ci-dessous.
  Je vous joins également une capture d'écran pour faciliter la compréhension du problème.
  ————
  Erreur : ${error}
  ————`,
        }"
        >Signalez ce problème</a
      >
      en décrivant ce que vous faisiez avant que cette erreur n'apparaisse en
      joignant si possible une capture d'écran. Nous vous répondrons au plus
      vite et corrigerons le problème dès que possible.
    </p>

    <p>Veuillez nous excuser pour la gêne occasionnée.</p>

    <p
      ><small>
        Informations techniques :
        <pre>{{ error }}</pre>
      </small></p
    >
  </div>
</template>

<script lang="ts">
import { useStore } from "@/stores/index.js"
import { EventAction, EventCategory } from "@lib/enums/event.js"

export default {
  name: "ErrorSaveBlock",
  setup() {
    return {
      store: useStore(),
    }
  },
  data() {
    return {
      issueTrackingEvent: {
        action: EventAction.Support,
        category: EventCategory.Contact,
      },
    }
  },
  computed: {
    error() {
      let value = this.store.saveSituationError
      return value instanceof String || value instanceof Error
        ? value
        : JSON.stringify(value, null, 2)
    },
  },
}
</script>
