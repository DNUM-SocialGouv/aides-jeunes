<script setup lang="ts">
import LieuInformations from "@/components/lieu-informations.vue"
import BackButton from "@/components/buttons/back-button.vue"
import { useLieux } from "@/composables/use-lieux.js"
import { computed, onMounted } from "vue"

const { benefit, currentLieu, updating } = useLieux()

const fallback = computed(() =>
  benefit.value?.id ? `/simulation/resultats/${benefit.value.id}` : null,
)

onMounted(() => {
  updating.value = true
})
</script>

<template>
  <div class="fr-pt-2w">
    <BackButton class="fr-mb-2w" size="small" :fallback="fallback">
      Retour au détail de l'aide
    </BackButton>
    <h2 class="fr-h5 fr-mt-2w fr-mb-4w">
      {{ currentLieu?.nom }}
    </h2>
    <p v-show="updating">
      <span
        class="fr-icon--ml fr-icon-refresh-line fr-icon-spin"
        aria-hidden="true"
      ></span
      ><span class="fr-ml-2w">Récupération des informations en cours…</span>
    </p>
    <LieuInformations
      v-if="currentLieu && !updating"
      :key="currentLieu.id"
      :lieu="currentLieu"
    />
  </div>
</template>
