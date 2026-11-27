<script setup lang="ts">
import { useLieux } from "@/composables/use-lieux.js"
import LieuLight from "@/components/lieu-light.vue"
import { computed, ref } from "vue"

const { lieux } = useLieux()

const showLieux = ref(false)

const lieuxPreview = computed(() => {
  return lieux?.value?.slice(0, 2)
})
</script>

<template>
  <div
    v-if="lieux?.length > 0"
    data-testid="nearby-places"
    class="fr-hr fr-py-2w"
  >
    <h3 class="fr-h6">Comment me faire accompagner près de chez moi ?</h3>
    <p>
      Vous pouvez vous faire accompagner pour faire votre demande et poser
      toutes vos questions.
    </p>
    <div v-if="lieux?.length" class="fr-mt-2w">
      <div
        v-for="(lieu, index) in showLieux ? lieux : lieuxPreview"
        :key="index"
      >
        <LieuLight :lieu="lieu" />
      </div>
      <button
        v-if="lieux?.length > 1"
        class="fr-btn fr-btn--secondary fr-ml-2w fr-mt-2w"
        @click="showLieux = !showLieux"
      >
        <span v-if="showLieux">Réduire l'affichage des lieux</span>
        <span v-else>Afficher tous les lieux</span>
      </button>
    </div>
  </div>
</template>
