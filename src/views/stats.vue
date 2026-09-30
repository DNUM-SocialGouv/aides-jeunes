<template>
  <article class="fr-article">
    <h1>Statistiques d'usage</h1>

    <p>
      Les
      <a
        :href="`${matomoBaseURL}/index.php?module=CoreHome&action=index&idSite=${matomoId}&period=day&date=yesterday`"
      >
        statistiques d'usage de Mes Aides
      </a>
      sont publiques.
    </p>
    <p>
      Comprenez comment nous évaluons la
      <a
        href="https://blog.beta.gouv.fr/dinsic/2016/11/04/mes-aides-metriques-pirates-tunnel-conversion-public/"
      >
        performance de Mes Aides
      </a>
      et comment nous
      <a
        href="https://blog.beta.gouv.fr/dinsic/2017/05/03/mes-aides-datascience-public/"
      >
        améliorons notre simulateur
      </a>
      .
    </p>
    <p>
      Les informations suivantes peuvent être retrouvées sur un
      <a
        target="_blank"
        title="Statistiques d'impact du simulateur d'aides 1jeune1solution - Nouvelle fenêtre"
        rel="noopener"
        href="https://betagouv.github.io/mes-aides-analytics/"
      >
        site dédié
      </a>
      .
    </p>

    <!-- Carte interactive des aides et simulations par département -->
    <StatsMap />

    <iframe
      id="iframe"
      title="Statistiques d'impact du simulateur d'aides 1jeune1solution"
      class="fr-col-12"
      src="https://betagouv.github.io/mes-aides-analytics/iframe"
      scrolling="no"
      @load="iframeLoaded"
    />
  </article>
</template>

<script setup lang="ts">
import iframeResize from "@iframe-resizer/parent/index.cjs"
import StatsMap from "@/components/stats-map.vue"

const iframeLoaded = () => {
  iframeResize({ log: false, license: "GPLv3" }, "#iframe")
}

const matomoBaseURL = process.env.VITE_MATOMO_URL
const matomoId = process.env.VITE_MATOMO_ID
</script>
