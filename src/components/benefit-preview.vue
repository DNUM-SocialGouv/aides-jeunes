<script setup lang="ts">
import { getBenefitImage } from "@lib/benefits/details.js"
import DroitEstime from "./droit-estime.vue"
import WarningMessage from "@/components/warning-message.vue"
import { capitalize, isBoolean } from "@lib/utils.js"
import { StandardBenefit } from "@data/types/benefits"
import { APPOINTMENT_LABEL } from "@lib/enums/cta.js"

const props = defineProps({
  benefit: Object,
})

const askBenefitLabelButton = (benefit) => {
  if (benefit.is_appointment) {
    return `${APPOINTMENT_LABEL} pour ${benefit.prefix}${
      benefit.prefix == "l’" ? "" : " "
    }${benefit.label}`
  }
  return `Demander ${benefit.prefix}${benefit.prefix == "l’" ? "" : " "}${
    benefit.label
  }`
}
</script>

<template>
  <div v-if="props.benefit">
    <router-link
      class="fr-tile fr-tile--horizontal"
      :to="`/simulation/resultats/${props.benefit.id}`"
      itemscope
      itemtype="http://schema.org/GovernmentService"
      :data-testid="props.benefit.id"
      :aria-label="askBenefitLabelButton(props.benefit)"
    >
      <div>
        <div class="aj-benefit-header fr-mb-4w">
          <img
            class="aj-institution-icon"
            :src="getBenefitImage(props.benefit as StandardBenefit)"
            :alt="`Logo ${props.benefit.institution.label}`"
          />
          <div class="aj-benefit-name">
            <h2 class="fr-text--lead" itemprop="name">{{
              capitalize(props.benefit.label)
            }}</h2>
            <div class="aj-benefit-institution"
              >{{ capitalize(props.benefit.institution.label) }}
            </div>
            <div>
              <p
                class="fr-text--justify fr-mt-1w"
                v-html="props.benefit.description"
              />
              <WarningMessage
                v-if="
                  benefit?.montant &&
                  isBoolean(benefit.montant) &&
                  benefit.warning === true
                "
              >
                <img src="@/assets/images/warning.svg" alt="" /> Attention,
                cette aide vous est accessible sous certaines conditions
                supplémentaires.
              </WarningMessage>
            </div>
          </div>
          <DroitEstime :droit="props.benefit as StandardBenefit" />
        </div>
        <ul class="fr-btns-group fr-btns-group--inline-sm fr-btns-group--right">
          <li>
            <router-link
              :to="`/simulation/resultats/${props.benefit.id}`"
              class="fr-btn fr-my-0"
              data-testid="aide-cta"
            >
              {{
                props.benefit.is_appointment
                  ? APPOINTMENT_LABEL
                  : "Demander cette aide"
              }}
            </router-link>
          </li>
        </ul>
      </div>
    </router-link>
  </div>
</template>
