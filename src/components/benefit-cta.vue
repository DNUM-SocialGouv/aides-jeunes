<script setup lang="ts">
import BenefitCtaLink from "./benefit-cta-link.vue"
import { CTALabel } from "@lib/enums/cta.js"
import { EventAction, EventCategory } from "@lib/enums/event.js"
import { StandardBenefit } from "@data/types/benefits.d.js"
import { computed, PropType } from "vue"
import { useBenefits } from "@/composables/use-benefits"

const props = defineProps({
  benefit: Object as PropType<StandardBenefit>,
})

const { benefits } = useBenefits()

const ctaForm = computed(() => {
  return ctas.value.find((cta) => cta?.type === CTALabel.Form)
})

const ctaTeleservice = computed(() => {
  return ctas.value.find((cta) => cta?.type === CTALabel.Teleservice)
})

const ctaNeedRegister = computed(() => {
  return ctas.value.find((cta) => cta?.type === CTALabel.NeedRegister)
})

const ctaTeleservicePrefill = computed(() => {
  return (
    !ctaTeleservice.value &&
    ctas.value.find((cta) => cta?.type === CTALabel.TeleservicePrefill)
  )
})

const ctaInstructions = computed(() => {
  return ctas.value.find((cta) => cta?.type === CTALabel.Instructions)
})

const ctas = computed(() => {
  const ctaBehaviourTypes = [
    CTALabel.Teleservice,
    CTALabel.NeedRegister,
    CTALabel.Form,
    CTALabel.Instructions,
    CTALabel.TeleservicePrefill,
  ]

  return ctaBehaviourTypes
    .map((type) => {
      if (props.benefit) {
        const linkGenerator = props.benefit[`${type}Generator`]
        const link = props.benefit[type] || (linkGenerator && linkGenerator())
        return {
          type,
          link,
        }
      }
    })
    .filter((item) => item?.link)
    .slice(0, 2)
})
</script>

<template>
  <ul
    v-if="benefit?.is_appointment && ctaTeleservice"
    class="fr-btns-group fr-btns-group--inline-md"
  >
    <li>
      <BenefitCtaLink
        :analytics-name="benefit.id"
        :benefit="benefit"
        :link="ctaTeleservice.link"
        :type="ctaTeleservice.type"
        class="fr-btn"
      />
    </li>
  </ul>
  <div
    v-else-if="ctas.length > 0 && benefit"
    class="fr-container fr-py-2w fr-callout"
  >
    <h5 class="fr-h5">Comment l'obtenir ?</h5>
    <div class="fr-grid-row fr-mb-2w fr-grid-row--middle">
      <div
        v-if="ctaTeleservice || ctaTeleservicePrefill || ctaForm"
        class="fr-col-12 fr-py-1w fr-mr-2w"
      >
        <ol v-if="ctaNeedRegister">
          <li
            >Consulter cette
            <BenefitCtaLink
              :analytics-name="benefit.id"
              :benefit="benefit"
              :link="benefit.link"
              :type="CTALabel.Link"
              :custom-label="'page d\'informations'"
            />
            avant de commencer la démarche</li
          >
          <li>Créer un compte ou se connecter sur la plateforme ci-dessous</li>
        </ol>
        <ul class="fr-btns-group fr-btns-group--inline-sm fr-btns-group--sm">
          <li v-if="ctaTeleservice">
            <BenefitCtaLink
              :analytics-name="benefit.id"
              :benefit="benefit"
              :link="ctaTeleservice.link"
              :type="ctaTeleservice.type"
              class="fr-btn fr-btn--sm"
            />
          </li>
          <li v-if="ctaTeleservicePrefill">
            <BenefitCtaLink
              :analytics-name="benefit.id"
              :benefit="benefit"
              :link="ctaTeleservicePrefill.link"
              :type="ctaTeleservicePrefill.type"
              class="fr-btn fr-btn--sm"
            />
          </li>
          <li v-if="ctaForm">
            <BenefitCtaLink
              :analytics-name="benefit.id"
              :benefit="benefit"
              :link="ctaForm.link"
              :type="ctaForm.type"
              class="fr-btn fr-btn--secondary fr-btn--sm"
            />
          </li>
        </ul>
      </div>
      <div class="fr-col fr-my-1w">
        <BenefitCtaLink
          v-if="ctaInstructions"
          class="aj-a"
          :analytics-name="benefit.id"
          :benefit="benefit"
          :link="ctaInstructions.link"
          :type="ctaInstructions.type"
        />
      </div>
    </div>
    <div class="fr-print-hidden">
      <a
        v-if="benefit.msa"
        v-analytics="{
          name: benefit.id,
          action: EventAction.Msa,
          category: EventCategory.General,
          benefits: benefits,
        }"
        class="aj-droit-pro-agricole"
        href="https://www.msa.fr/lfy/espace-prive"
        rel="noopener"
        target="_blank"
        title="Démarches pour les professions agricoles - Nouvelle fenêtre"
      >
        <img alt="" src="@/assets/images/doigt.svg" class="fr-mr-1w" />Démarches
        pour les professions agricoles
      </a>
    </div>
  </div>
</template>
