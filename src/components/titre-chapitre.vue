<template>
  <div class="fr-container--fluid fr-px-0 fr-py-2w">
    <div
      v-if="shouldDisplayResults && hasBenefits && showEmailButton"
      class="fr-grid-row"
    >
      <div class="fr-col-12 fr-col-md-6 fr-col-lg-6">
        <h1 class="fr-my-0 fr-mx-0">{{ title }}</h1>
      </div>
      <div class="fr-col-12 fr-col-md-6 fr-col-lg-6">
        <ul
          class="fr-btns-group fr-btns-group--inline-md fr-btns-group--right fr-mt-1w fr-px-0"
        >
          <li>
            <SendRecapButton
              data-testid="send-email-and-sms-button"
              :text="emailButtonTitle"
            ></SendRecapButton>
          </li>
        </ul>
      </div>
    </div>
    <div v-else class="fr-grid-row">
      <div class="fr-col-12 fr-col-sm-6">
        <h1 class="fr-my-0 fr-mx-0">{{ title }}</h1>
      </div>
      <div
        v-if="showRevenirPlusTard"
        class="fr-col-12 fr-col-sm-6 aj-revenirplustard"
      >
        <router-link
          :to="{ name: 'revenirPlusTard' }"
          data-testid="come-back-later-link"
        >
          Revenir plus tard ?
        </router-link>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Chapters from "@lib/chapters.js"
import SendRecapButton from "@/components/buttons/send-recap-button.vue"
import { useStore } from "@/stores/index.js"
import { useRouter } from "vue-router"
import { useResultsStore } from "@/stores/results.js"

export default {
  name: "TitreChapitre",
  components: { SendRecapButton },
  setup() {
    return {
      store: useStore(),
      router: useRouter(),
      resultsStore: useResultsStore(),
    }
  },
  computed: {
    hasBenefits() {
      return this.resultsStore.hasBenefits
    },
    shouldDisplayResults() {
      return this.resultsStore.shouldDisplayResults
    },
    showSMS() {
      return process.env.VITE_SHOW_SMS_TAB
    },
    title() {
      return this.getTitleByRoute(this.$route)
    },
    showEmailButton() {
      return (
        this.$route.name === "resultats" && !this.store.simulationAnonymized
      )
    },
    showRevenirPlusTard() {
      return (
        this.$route.name !== "revenirPlusTard" &&
        !this.$route.path.includes("date_naissance") &&
        !this.$route.path.includes("simulation/resultat")
      )
    },
    emailButtonTitle() {
      return this.showSMS
        ? "Recevoir les résultats par email/SMS"
        : "Recevoir les résultats par email"
    },
    emailModalTitle() {
      return this.showSMS
        ? "Recevoir un récapitulatif"
        : "Recevoir un récapitulatif par email"
    },
  },
  methods: {
    getTitleByRoute(route) {
      const path = route.path
      if (path === "/simulation/recapitulatif") {
        return "Récapitulatif"
      }
      if (path.includes("simulation/resultats/inattendu/")) {
        return "Résultat inattendu"
      }
      if (path === "/simulation/resultats/recapitulatif_email") {
        return this.emailModalTitle
      }
      if (path === "/simulation/revenir-plus-tard") {
        return "Revenir plus tard ?"
      }

      const current = path.replace(/\/en_savoir_plus/, "")
      const step =
        (this.store.passSanityCheck || this.store.simulationAnonymized) &&
        this.$state.current(current, this.store.getAllSteps)
      const chapterName = step?.chapter || ""
      return Chapters.getLabel(chapterName)
    },
    goToRecapitulatifPage() {
      this.$router.push({ name: "recapitulatif" })
    },
  },
}
</script>
