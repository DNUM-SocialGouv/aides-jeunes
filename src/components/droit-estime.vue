<template>
  <div
    v-if="
      droit.type &&
      ($route.name !== 'aide' ||
        ($route.name === 'aide' && droit.source === 'javascript'))
    "
    class="aj-benefit-amount"
  >
    <div class="fr-text--center">
      <template v-if="isBenefitTypeNumber || isBenefitTypeString">
        <span>
          {{ droitEstime.label }}
        </span>
        <br />
        <strong class="fr-text--lead" data-testid="droit-estime-value">
          {{ droitEstime.value }} </strong
        >&nbsp;
        <strong
          v-if="droitEstime.legend"
          class="fr-text--lead"
          data-testid="droit-estime-legend"
        >
          {{ droitEstime.legend }}
        </strong>
      </template>
    </div>
    <div class="fr-text--center">
      <AnalyticRouterLink
        v-if="showUnexpectedLink"
        :analytic-name="droit.id"
        :analytic-action="eventTypeShowUnexpected"
        :to="{ name: 'resultatInattendu', params: { id: droit.id } }"
      >
        {{ unexpectedLinkLabel }}
      </AnalyticRouterLink>
    </div>
  </div>
</template>

<script lang="ts">
import { formatDroitEstime } from "@lib/benefits/details.js"
import { useStore } from "@/stores/index.js"
import AnalyticRouterLink from "@/components/buttons/analytic-router-link.vue"
import { EventAction } from "@lib/enums/event.js"
import { StandardBenefit } from "@data/types/benefits.d.js"
import { PropType } from "vue"

export default {
  name: "DroitEstime",
  components: {
    AnalyticRouterLink,
  },
  props: {
    droit: {
      type: Object as PropType<StandardBenefit>,
      required: true,
    },
    showUnexpected: {
      type: Boolean,
      default: true,
    },
  },
  setup() {
    return {
      store: useStore(),
    }
  },
  data() {
    return {
      eventTypeShowUnexpected: EventAction.ShowUnexpected,
    }
  },
  computed: {
    droitEstime() {
      return formatDroitEstime(this.droit, this.store.openFiscaParameters)
    },
    isBenefitTypeNumber() {
      return this.droitEstime.type === "float"
    },
    isBenefitTypeString() {
      return this.droitEstime.type === "string"
    },
    unexpectedLinkLabel() {
      return this.droit.type === "bool"
        ? "Résultat inattendu ?"
        : "Montant inattendu ?"
    },
    showUnexpectedLink() {
      return (
        this.showUnexpected &&
        ((this.droit.isBaseRessourcesYearMinusTwo &&
          !this.store.ressourcesYearMinusTwoCaptured) ||
          this.droit.showUnexpectedAmount)
      )
    },
  },
}
</script>
