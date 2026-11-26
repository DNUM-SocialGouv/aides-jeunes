<template>
  <div>
    <WarningMessage v-if="error" class="fr-mb-4w" role="alert">{{
      error
    }}</WarningMessage>
    <div class="aj-action-buttons fr-mt-2w">
      <ul
        class="fr-btns-group fr-btns-group--inline fr-btns-group--inline-reverse fr-btns-group--right"
      >
        <li>
          <button
            class="fr-btn"
            type="submit"
            :class="{ 'fr-btn-disabled': disableSubmit }"
            @click="localOnSubmit($event)"
          >
            Suivant
          </button>
        </li>
        <li>
          <slot />
          <BackButton fallback="/" />
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import BackButton from "@/components/buttons/back-button.vue"
import { computed, onMounted, onUnmounted } from "vue"
import { useStore } from "@/stores/index.js"
import WarningMessage from "@/components/warning-message.vue"

const props = defineProps({
  onSubmit: {
    type: Function,
    default() {},
  },
  disableSubmit: Boolean,
})

onMounted(() => {
  document.body.setAttribute("data-action-buttons", "true")
})
onUnmounted(() => {
  document.body.removeAttribute("data-action-buttons")
})

const store = useStore()
const error = computed(() => {
  return store.error
})

const localOnSubmit = (event) => {
  event.preventDefault()
  props.onSubmit()
}
</script>
