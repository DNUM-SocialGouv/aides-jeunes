<template>
  <div v-if="afficheBandeau" class="aj-bandeau-demo-wrapper">
    <a
      class="aj-bandeau-demo"
      target="_blank"
      title="Démo - Nouvelle fenêtre"
      rel="noopener"
      :href="link"
    >
      Démo
    </a>
    <a v-if="benefitLink" class="aj-bandeau-lien-debug" :href="benefitLink"
      >Accéder aux aides ajoutées</a
    >
  </div>
</template>

<script lang="ts">
import axios from "axios"

export default {
  name: "BandeauDemo",
  data: function () {
    return {
      benefitLink: null,
    }
  },
  computed: {
    afficheBandeau() {
      return process.env.VITE_CONTEXT === "deploy-preview"
    },
    link() {
      return process.env.VITE_PR_URL
    },
  },
  mounted: async function () {
    if (process.env.VITE_NETLIFY_PR) {
      const pr = process.env.VITE_NETLIFY_PR.split("/")
      if (pr.length < 3) return
      const url = `https://api.github.com/repos/DNUM-SocialGouv/aides-jeunes/pulls/${pr[1]}/files`
      axios
        .get(url)
        .then((response) => {
          const benefitIds: string[] = []
          for (let entry of response.data) {
            const match = entry.filename.match(
              /data\/benefits\/(?:openfisca|javascript)\/(.*)(?:\.yml|\.yaml)$/i,
            )
            if (match) {
              benefitIds.push(match[1])
            }
          }
          if (benefitIds.length) {
            this.benefitLink = `/simulation/resultats?debug=${benefitIds.join(
              ",",
            )}`
          }
        })
        .catch((e) => {
          console.log("Failed to find a benefit file name from this PR", e)
        })
    }
  },
}
</script>
