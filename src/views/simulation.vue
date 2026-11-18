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
  },
  methods: {
    disableDebug() {
      this.store.setDebug(false)
      this.$router.replace({ debug: null })
    },
  },
}
</script>
