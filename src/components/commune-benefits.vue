<template>
  <article class="fr-article">
    <div class="fr-grid-row fr-grid-row--gutters">
      <h1>
        Aides pour les résidants de {{ name }}
        <div
          v-if="totalBenefitsCount > 0"
          class="fr-badge fr-badge--success fr-p-1v fr-px-2v"
        >
          {{ formatTotalCount(totalBenefitsCount, "aide") }}
        </div>
      </h1>

      <div class="fr-col-12">
        <p class="fr-text--md fr-mb-1w">
          Toutes les aides financières proposées aux résidants de
          {{ name }} en matière de
          <b
            >logement, transport, santé, formation, emploi, culture, sport et
            alimentation</b
          >.
        </p>
      </div>
    </div>

    <template
      v-for="(institutions, type) in institutionsGroups"
      :key="String(type)"
    >
      <div v-if="countBenefits(institutions) > 0" class="fr-mb-6w">
        <h2 :id="`liste_${String(type)}`">
          {{ types[type] }}
          <span class="fr-badge fr-badge--success fr-ml-1w">
            {{ formatCount(countBenefits(institutions), "aide") }}
          </span>
        </h2>

        <div class="fr-grid-row fr-grid-row--gutters">
          <div
            v-for="institution in institutions"
            :key="institution.id"
            class="fr-col-12"
          >
            <div class="fr-card">
              <div class="fr-card__body">
                <div class="fr-card__content">
                  <h3
                    :id="institution.id"
                    class="fr-card__title fr-mb-n2w fr-mt-1w"
                  >
                    {{ institution.label }}
                  </h3>
                </div>
                <div class="fr-card__footer">
                  <ul class="fr-links-group fr-list--no-bullet">
                    <li
                      v-for="benefit in institution.benefits"
                      :key="benefit.id"
                      class="fr-my-1w"
                    >
                      <router-link
                        class="fr-link fr-icon-arrow-right-line fr-link--icon-right"
                        :to="{
                          name: 'aide',
                          params: { benefitId: benefit.id },
                          query: { from: `institution/${postalCode}` },
                        }"
                      >
                        {{ capitalize(benefit.label) }}
                      </router-link>
                      <span
                        v-if="getBenefitAmount(benefit.id)"
                        class="fr-badge fr-badge--info fr-badge--no-icon fr-badge--sm fr-m-1w"
                      >
                        {{ getBenefitAmount(benefit.id) }}
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
    <StartSimulationCta />
  </article>
</template>

<script setup lang="ts">
import CommuneMethods from "@/lib/commune"
import { computed, ref, onMounted } from "vue"
import institutionsBenefits from "generator:institutions"
import benefitsMap from "generator:benefits"
import { capitalize } from "@lib/utils"
import { Commune } from "@lib/types/commune"
import StartSimulationCta from "@/components/start-simulation-cta.vue"
import { getBenefitLegend } from "@lib/benefits/details.js"
import { OpenfiscaParameters } from "@lib/types/parameters.d.js"
import { institutionTypesLabels as types } from "@lib/institution-types.js"

interface Props {
  postalCode: string
  name: string
}

const props = defineProps<Props>()

const selectedCommune = ref<Commune | null>(null)

const institutionsGroups = computed(() => {
  if (!selectedCommune.value) {
    return {}
  }

  return {
    commune: institutionsBenefits["commune"].filter(
      (commune) => commune.location === selectedCommune.value!.code,
    ),
    epci: institutionsBenefits["epci"].filter((epci) =>
      epci.location?.includes(selectedCommune.value!.code),
    ),
    departement: institutionsBenefits["departement"].filter(
      (departement) =>
        departement.location === selectedCommune.value!.departement,
    ),
    region: institutionsBenefits["region"].filter(
      (region) => region.location === selectedCommune.value!.region,
    ),
    national: institutionsBenefits["national"],
    caf: institutionsBenefits["caf"].filter((caf) =>
      caf.location?.includes(selectedCommune.value!.departement),
    ),
  }
})

const countBenefits = (institutions) =>
  institutions.reduce(
    (total, institution) => total + (institution?.benefits?.length || 0),
    0,
  )

const formatCount = (count: number, label: string) =>
  `${count} ${label}${count > 1 ? "s" : ""}`

const formatTotalCount = (count: number, label: string) =>
  `${count} ${label}${count > 1 ? "s" : ""} au total`

const getBenefitAmount = (benefitId: string) => {
  const benefit = benefitsMap[benefitId]
  if (!benefit?.montant) return null

  const { montant, unit = "" } = benefit
  const legend = getBenefitLegend(benefit, {} as OpenfiscaParameters)

  const parts = [montant, unit, legend].filter(Boolean)
  return parts.length > 1 ? parts.join(" ") : null
}

const totalBenefitsCount = computed(() =>
  Object.values(institutionsGroups.value).reduce(
    (total, institutions) => total + countBenefits(institutions || []),
    0,
  ),
)

onMounted(async () => {
  const res = await CommuneMethods.get(props.postalCode)
  selectedCommune.value = res[0]
})
</script>
