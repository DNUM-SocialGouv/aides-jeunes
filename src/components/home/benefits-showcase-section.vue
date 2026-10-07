<template>
  <div class="fr-background-alt--grey fr-py-6w fr-mt-6w">
    <div class="fr-container">
      <h2 class="fr-h3 fr-mb-4w">
        Ne passez à côté d'aucune aide financière
      </h2>
      <div class="fr-grid-row fr-grid-row--gutters">
        <div class="fr-col-12 fr-col-md-6">
          <img
            src="https://dnum-socialgouv.github.io/aides-jeunes-files/public/resultats_simulation.gif"
            alt="Capture d'écran de la page de résultats"
            class="fr-responsive-img fr-mb-2w"
          />
        </div>
        <div class="fr-col-12 fr-col-md-6">
          <ul class="fr-list fr-list--no-bullet">
            <li
              v-for="(aide, index) in aides"
              :key="`aide-${index}`"
              class="fr-mb-2w"
            >
              <a
                :href="aide.link"
                target="_blank"
                rel="noopener"
                :title="`${aide.name} - Nouvelle fenêtre`"
                class="fr-link fr-fi-arrow-right-line fr-link--icon-right"
              >
                {{ aide.name }}
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const aides = [
  {
    name: "Départ 18-25",
    link: "/aides/depart1825_montant_maximum",
  },
  { name: "Pass Sport", link: "/aides/pass_sport" },
  {
    name: "Bourse sur critères sociaux",
    link: "/aides/bourse_criteres_sociaux",
  },
  { name: "Prime d'Activité", link: "/aides/ppa" },
  { name: "Revenu de solidarité active (RSA)", link: "/aides/rsa" },
  {
    name: "Complémentaire santé solidaire (CSS)",
    link: "/aides/css_participation_forfaitaire",
  },
  {
    name: "Allocations familiales",
    link: "/aides?keyword=allocations+familiales",
  },
  { name: "Aides covoiturage", link: "/aides?keyword=covoiturage" },
  { name: "Aides vélo", link: "/aides?keyword=vélo" },
]
</script>
