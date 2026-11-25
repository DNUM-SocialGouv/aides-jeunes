<template>
  <ProgressBar></ProgressBar>
  <div class="fr-grid-row aj-column-container">
    <div v-if="showSummary" class="fr-col-12 fr-col-md-3 aj-main-container">
      <ProgressDebugger v-if="debug" />
      <ChaptersSummary v-else />
    </div>
    <div
      :class="`fr-col-12 fr-p-2w ${
        showSummary ? 'fr-col-md-9' : 'fr-col-md-12'
      }`"
    >
      <TitreChapitre />
      <div v-if="debug" class="fr-mb-md-2w">
        <button class="fr-btn fr-btn--sm" @click="disableDebug"
          >Quitter le mode debug
        </button>
      </div>
      <WarningMessage v-if="store.message.text" data-testid="warning-message">
        <div v-html="store.message.text" />
      </WarningMessage>
      <div
        v-if="franceConnectConnected"
        class="fr-alert fr-alert--info fr-my-1w"
      >
        <a
          href="/api/france-connect/logout"
          aria-label="FranceConnect"
          role="link"
        >
          Se déconnecter de FranceConnect
        </a>
      </div>
      <div
        v-if="franceConnectError"
        class="fr-alert fr-alert--warning fr-my-1w"
      >
        <p>Connection FranceConnect : Une erreur est survenue !</p>
      </div>
      <div
        v-else-if="displayFranceConnect"
        class="fr-alert fr-alert--info fr-my-1w"
      >
        <div class="fr-connect-group">
          <a
            href="/api/france-connect/login"
            aria-label="FranceConnect"
            role="link"
          >
            <button class="fr-connect">
              <span class="fr-connect__login">S’identifier avec</span>
              <span class="fr-connect__brand">FranceConnect</span>
            </button>
          </a>
          <p>
            <a
              href="https://franceconnect.gouv.fr/"
              target="_blank"
              rel="noopener"
              title="Qu’est-ce que FranceConnect ? - nouvelle fenêtre"
              >Qu’est-ce que FranceConnect ?</a
            >
          </p>
        </div>
      </div>

      <div>
        <router-view :key="$route.path" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import TitreChapitre from "@/components/titre-chapitre.vue"
import ProgressDebugger from "@/components/progress.vue"
import ChaptersSummary from "@/components/summary.vue"
import ProgressBar from "@/components/progress-bar.vue"
import WarningMessage from "@/components/warning-message.vue"
import { useStore } from "@/stores/index.js"

export default {
  name: "Simulation",
  components: {
    WarningMessage,
    ProgressBar,
    TitreChapitre,
    ProgressDebugger,
    ChaptersSummary,
  },
  setup() {
    return {
      store: useStore(),
    }
  },
  data() {
    return {
      window,
    }
  },
  computed: {
    showSummary() {
      return !this.store.simulationAnonymized
    },
    debug() {
      return this.store.getDebug
    },
    isOnFirstSimulationPage() {
      return (
        this.store.getAllSteps[0].path === this.$route.path &&
        this.store.simulation.answers.all.length === 0
      )
    },
    displayFranceConnect() {
      return (
        this.$route.query["france-connect-enabled"] === "true" &&
        process.env.VITE_FRANCE_CONNECT_ENABLED &&
        this.isOnFirstSimulationPage &&
        !this.franceConnectConnected
      )
    },
    franceConnectError() {
      return this.$route.query.error == "france_connect_error"
    },
    franceConnectConnected() {
      return this.$cookies.get("fc_id_token_hint")
    },
  },
  methods: {
    disableDebug() {
      this.store.setDebug(false)
      this.$router.replace({ debug: null })
    },
  },
}
</script>
