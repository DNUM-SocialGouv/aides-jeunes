<template>
  <article class="fr-article">
    <div class="fr-grid-row fr-grid-row--gutters">
      <div class="fr-col-12">
        <h1>Toutes les aides</h1>
      </div>
      <div v-if="showNavigationButtons" class="aj-home-group-buttons-container">
        <div class="fr-mb-2w fr-mr-2w">
          <BackButton
            data-testid="benefits-liste-back-button"
            as-link
            to="/"
            size="small"
            btn-type="tertiary"
          >
            Retour à l'accueil
          </BackButton>
        </div>
        <HomeSimulationGroupButtons
          :horizontal="true"
          size="small"
          :reverse="true"
        />
      </div>
    </div>

    <div>
      <p class="fr-badge fr-my-2w">Total : {{ benefitsCount }} aides</p>
    </div>

    <div class="fr-grid-row fr-grid-row--gutters">
      <div class="fr-col-12 fr-col-md-6">
        <div class="fr-form-group">
          <label class="fr-label" for="zipcode-input"
            >Filtrer par code postal :</label
          >
          <input
            id="zipcode-input"
            v-model="zipCode"
            type="text"
            class="fr-input"
            placeholder="Ex: 75001"
            maxlength="5"
            @input="computeZipCode"
          />
        </div>
      </div>
      <div class="fr-col-12 fr-col-md-6">
        <div class="fr-form-group">
          <label class="fr-label" for="keyword-input"
            >Rechercher par mots-clés :</label
          >
          <input
            id="keyword-input"
            v-model="searchTerms"
            type="text"
            class="fr-input"
            placeholder="Ex: logement, vélo, bafa, allocation"
            @input="computeKeywords"
          />
        </div>
      </div>
    </div>

    <div
      v-if="selectedCommune || searchTerms"
      class="fr-alert fr-mt-3w"
      :class="alertClass"
    >
      <p v-if="countFilteredBenefits() > 0">
        {{ countFilteredBenefits() }} aides disponibles
        <span v-if="selectedCommune">
          pour la commune de {{ selectedCommune.nom }}
        </span>
        <span v-else-if="searchTerms">
          pour la recherche "{{ searchTerms }}"
        </span>
      </p>
      <p v-else>
        Aucune aide trouvée
        <span v-if="selectedCommune"> pour le code postal {{ zipCode }} </span>
        <span v-else-if="searchTerms"> pour "{{ searchTerms }}" </span>
      </p>
    </div>

    <div v-for="(institutions, type) in institutionsGroups" :key="type">
      <h2 :id="`liste_${type}`">{{ types[type] }}</h2>
      <p>
        Nombre d'aides :
        {{
          institutions.reduce(
            (acc, institution) => acc + institution.benefits.length,
            0,
          )
        }}
        <br />
        Nombre d'institutions :
        {{ institutions.length }}
      </p>
      <div v-for="institution in institutions" :key="institution.id">
        <h3 :id="institution.id" class="aj-question">
          <router-link
            :title="`Lien vers la liste des aides de l'institution ${institution.label}`"
            :to="{
              path: `/aides`,
              hash: `#${institution.id}`,
            }"
            aria-current="none"
          >
            {{ institution.label }}
          </router-link>
        </h3>
        <p
          >{{
            institution.benefits.length > 1
              ? institution.benefits.length + " aides :"
              : institution.benefits.length + " aide :"
          }}
        </p>
        <ul>
          <li v-for="benefit in institution.benefits" :key="benefit.id">
            <router-link
              :to="{ name: 'aide', params: { benefitId: benefit.id } }"
            >
              {{ capitalize(benefit.label) }}
            </router-link>
          </li>
        </ul>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue"
import { useRoute } from "vue-router"
import BackButton from "@/components/buttons/back-button.vue"
import institutionsBenefits from "generator:institutions"
import CommuneMethods from "@/lib/commune.js"
import { Commune } from "@lib/types/commune.d.js"
import { capitalize, normalizeString } from "@lib/utils.js"
import { institutionTypesLabels as types } from "@lib/institution-types.js"
import HomeSimulationGroupButtons from "@/components/buttons/home-simulation-group-buttons.vue"

const props = defineProps<{ showNavigationButtons?: boolean }>()
const { showNavigationButtons = true } = props

const route = useRoute()
const zipCode = ref<string | null>(null)
const selectedCommune = ref<Commune | null>(null)
const searchTerms = ref<string | null>(null)
const benefitsCount = ref(process.env.VITE_BENEFIT_COUNT)
onMounted(() => {
  const keywordParam = route.query.keyword?.toString()
  if (keywordParam) {
    searchTerms.value = decodeURIComponent(keywordParam.replace(/\+/g, " "))
  }
})

const filterByBenefit = (type, searchTermsLower) => {
  return institutionsBenefits[type]
    .map((institution) => {
      const filteredBenefits = institution.benefits.filter(
        (benefit) =>
          normalizeString(benefit.label).includes(searchTermsLower) ||
          normalizeString(institution.label).includes(searchTermsLower),
      )
      if (filteredBenefits.length > 0) {
        return { ...institution, benefits: filteredBenefits } // Keep only the matching benefits
      }
    })
    .filter((item) => item) // Remove entities with no matching benefits
}

const institutionsGroups = computed(() => {
  if (selectedCommune.value) {
    return {
      europeen: institutionsBenefits["europeen"],
      national: institutionsBenefits["national"],
      region: institutionsBenefits["region"].filter(
        (region) => region.location === selectedCommune.value!.region,
      ),
      departement: institutionsBenefits["departement"].filter(
        (departement) =>
          departement.location === selectedCommune.value!.departement,
      ),
      epci: institutionsBenefits["epci"].filter((epci) =>
        epci.location?.includes(selectedCommune.value!.code),
      ),
      commune: institutionsBenefits["commune"].filter(
        (commune) => commune.location === selectedCommune.value!.code,
      ),
      caf: institutionsBenefits["caf"].filter((caf) =>
        caf.location?.includes(selectedCommune.value!.departement),
      ),
      msa: institutionsBenefits["msa"].filter((msa) =>
        msa.location?.includes(selectedCommune.value!.departement),
      ),
    }
  }
  if (searchTerms.value) {
    const searchTermsLower = normalizeString(searchTerms.value || "")
    return Object.fromEntries(
      Object.keys(types).map((type) => [
        type,
        filterByBenefit(type, searchTermsLower),
      ]),
    )
  }
  return institutionsBenefits
})

async function computeZipCode() {
  if (zipCode.value && zipCode.value.length > 2) {
    const res = await CommuneMethods.get(zipCode.value)
    selectedCommune.value = res[0]
  }
}

async function computeKeywords() {
  if (searchTerms.value && searchTerms.value.length > 2) {
    const res = await CommuneMethods.get(searchTerms.value)
    selectedCommune.value = res[0]
  }
}

watch(zipCode, (newZipCode: string | null) => {
  if (newZipCode && newZipCode.length > 2) {
    computeZipCode()
    searchTerms.value = null
  }
})
watch(searchTerms, (newSearchTerms: string | null) => {
  if (newSearchTerms && newSearchTerms.length > 2) {
    computeKeywords()
    zipCode.value = null
  }
})
function countFilteredBenefits(): number {
  return Object.keys(institutionsGroups.value).reduce((acc, type) => {
    return (
      acc +
      institutionsGroups.value[type].reduce(
        (benefitsCount, institution) =>
          benefitsCount + institution.benefits.length,
        0,
      )
    )
  }, 0)
}

const alertClass = computed(() =>
  countFilteredBenefits() > 0 ? "fr-alert--success" : "fr-alert--error",
)
</script>
