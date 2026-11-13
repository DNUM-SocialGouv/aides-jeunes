<script setup lang="ts">
import DroitsDetails from "@/components/droits-details.vue"
import { ref, onMounted } from "vue"
const benefit = ref()

// Seul l'éditeur Decap qui embarque cette page peut lui envoyer un contenu :
// il est rendu en HTML.
const allowedOrigins = [
  new URL(process.env.VITE_NETLIFY_CONTRIBUTION_URL || "http://localhost:3000")
    .origin,
  "http://localhost:3000",
]

function check(event) {
  if (allowedOrigins.includes(event.origin) && event.data?.source == "decap") {
    benefit.value = event.data.value
  }
}

onMounted(() => {
  addEventListener("message", check)
  window.top?.postMessage({ source: "aides-jeunes", value: "ready" }, "*")
})
</script>

<template>
  <DroitsDetails
    v-if="benefit"
    :droit="benefit"
    :droits="[benefit]"
    :city="'75056'"
    :patrimoine-captured="true"
    :ressources-year-minus-two-captured="true"
  />
</template>
