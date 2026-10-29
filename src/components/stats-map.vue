<template>
  <div class="fr-mt-4w">
    <div class="fr-grid-row fr-grid-row--gutters fr-mb-3w">
      <div class="fr-col-12 fr-col-md-4">
        <div class="fr-tile fr-tile--sm fr-tile--no-border stats-kpi-card">
          <div class="fr-tile__body">
            <div class="fr-tile__title stats-kpi-number">
              {{ totals.simulations.toLocaleString("fr-FR") }}
            </div>
            <div class="fr-tile__desc stats-kpi-label">
              simulations effectuées
            </div>
          </div>
        </div>
      </div>
      <div class="fr-col-12 fr-col-md-4">
        <div class="fr-tile fr-tile--sm fr-tile--no-border stats-kpi-card">
          <div class="fr-tile__body">
            <div class="fr-tile__title stats-kpi-number">
              {{ totals.benefits.toLocaleString("fr-FR") }}
            </div>
            <div class="fr-tile__desc stats-kpi-label"> aides référencées </div>
          </div>
        </div>
      </div>
      <div class="fr-col-12 fr-col-md-4">
        <div class="fr-tile fr-tile--sm fr-tile--no-border stats-kpi-card">
          <div class="fr-tile__body">
            <div class="fr-tile__title stats-kpi-number">
              {{ totals.nationalBenefits.toLocaleString("fr-FR") }}
            </div>
            <div class="fr-tile__desc stats-kpi-label"> aides nationales </div>
          </div>
        </div>
      </div>
      <div class="fr-col-12 fr-col-md-4">
        <div
          class="fr-tile fr-tile--sm fr-tile--no-border stats-kpi-card stats-kpi-card--local"
        >
          <div class="fr-tile__body">
            <div class="fr-tile__title stats-kpi-number">
              {{ totals.localBenefitsTotal.toLocaleString("fr-FR") }}
            </div>
            <div class="fr-tile__desc stats-kpi-label">
              aides locales (départements, régions, communes)
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="fr-card fr-card--no-border stats-map-card">
      <div class="fr-card__body">
        <div class="fr-card__content">
          <h2 class="fr-card__title fr-h4"> Répartition géographique </h2>

          <!-- Toggle mode -->
          <div
            class="stats-mode-toggle fr-mb-2w"
            role="group"
            aria-label="Mode d'affichage de la carte"
          >
            <button
              class="fr-btn fr-btn--sm"
              :class="mapMode === 'simulations' ? '' : 'fr-btn--secondary'"
              @click="mapMode = 'simulations'"
            >
              Simulations
            </button>
            <button
              class="fr-btn fr-btn--sm"
              :class="mapMode === 'localBenefits' ? '' : 'fr-btn--secondary'"
              @click="mapMode = 'localBenefits'"
            >
              Aides locales
            </button>
          </div>

          <p class="fr-text--sm fr-mb-2w fr-text--mention-grey">
            <template v-if="mapMode === 'simulations'">
              Simulations par département — sans commune renseignée comptées
              globalement.
            </template>
            <template v-else>
              Aides locales par département (régionales, départementales,
              communales…) — hors aides nationales.
            </template>
          </p>

          <div v-if="loading" class="fr-py-6w stats-map-loader">
            <div
              class="fr-icon-loader-line fr-icon--lg"
              aria-hidden="true"
            ></div>
            <p class="fr-mt-2w fr-text--sm">Chargement de la carte…</p>
          </div>

          <div v-else-if="error" class="fr-alert fr-alert--error fr-mb-2w">
            <p>{{ error }}</p>
          </div>

          <template v-else>
            <!-- Carte principale -->
            <div
              class="stats-map-wrapper"
              aria-label="Carte des simulations par département"
            >
              <svg
                ref="mapSvg"
                class="stats-map-svg"
                viewBox="0 0 850 600"
                xmlns="http://www.w3.org/2000/svg"
                role="img"
                :aria-label="`Carte France avec ${totals.simulations} simulations`"
              >
                <!-- Les paths seront injectés dynamiquement -->
                <g ref="deptGroup" class="departments"></g>

                <!-- Encarts DOM-TOM -->
                <g class="domtom-labels">
                  <text x="30" y="530" class="domtom-label">
                    971 Guadeloupe
                  </text>
                  <text x="30" y="548" class="domtom-label">
                    972 Martinique
                  </text>
                  <text x="200" y="530" class="domtom-label">973 Guyane</text>
                  <text x="200" y="548" class="domtom-label">
                    974 La Réunion
                  </text>
                  <text x="370" y="530" class="domtom-label">976 Mayotte</text>
                </g>
              </svg>

              <!-- Tooltip -->
              <div
                v-if="tooltip.visible"
                class="stats-map-tooltip fr-text--sm"
                :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
              >
                <strong class="fr-text--bold">{{ tooltip.name }}</strong>
                <br />
                <span class="tooltip-row tooltip-row--sims">
                  👥
                  <strong>{{
                    tooltip.simulations.toLocaleString("fr-FR")
                  }}</strong>
                  simulation{{ tooltip.simulations > 1 ? "s" : "" }}
                </span>
                <hr class="tooltip-divider" />
                <span class="tooltip-section-label">Aides disponibles</span>
                <span class="tooltip-row">
                  🇫🇷 Nationales :
                  <strong>{{
                    tooltip.nationalBenefits.toLocaleString("fr-FR")
                  }}</strong>
                </span>
                <template v-if="tooltip.localBenefits > 0">
                  <span
                    class="tooltip-section-label tooltip-section-label--local"
                    >Aides locales ({{ tooltip.localBenefits }})</span
                  >
                  <span
                    v-for="(count, typeKey) in tooltip.localByType"
                    :key="typeKey"
                    class="tooltip-row tooltip-row--type"
                  >
                    {{ typeLabels[typeKey]?.emoji || "📋" }}
                    {{ typeLabels[typeKey]?.label || typeKey }} :
                    <strong>{{ count }}</strong>
                  </span>
                </template>
                <span v-else class="tooltip-row tooltip-row--empty">
                  📍 Locales : <strong>0</strong>
                </span>
                <span class="tooltip-row tooltip-row--total">
                  Total :
                  <strong>{{
                    tooltip.totalBenefits.toLocaleString("fr-FR")
                  }}</strong>
                </span>
                <template v-if="tooltip.localBenefitNames.length > 0">
                  <hr class="tooltip-divider" />
                  <span class="tooltip-section-label"
                    >Détail des aides locales</span
                  >
                  <ul class="tooltip-benefit-list">
                    <li
                      v-for="(
                        benefitName, idx
                      ) in tooltip.localBenefitNames.slice(0, 8)"
                      :key="idx"
                      class="tooltip-benefit-item"
                    >
                      {{ benefitName }}
                    </li>
                    <li
                      v-if="tooltip.localBenefitNames.length > 8"
                      class="tooltip-benefit-item tooltip-benefit-more"
                    >
                      … et {{ tooltip.localBenefitNames.length - 8 }} autre{{
                        tooltip.localBenefitNames.length - 8 > 1 ? "s" : ""
                      }}
                    </li>
                  </ul>
                </template>
              </div>
            </div>

            <!-- Légende -->
            <div class="stats-map-legend fr-mt-2w">
              <span class="fr-text--sm fr-text--bold fr-mr-2w">
                {{
                  mapMode === "simulations" ? "Simulations" : "Aides locales"
                }}
                :
              </span>
              <div class="stats-map-legend-scale">
                <div
                  v-for="step in legendSteps"
                  :key="step.label"
                  class="stats-map-legend-step"
                >
                  <span
                    class="stats-map-legend-color"
                    :style="{ backgroundColor: step.color }"
                  ></span>
                  <span class="fr-text--xs">{{ step.label }}</span>
                </div>
              </div>
            </div>

            <!-- Tableau récapitulatif accessible -->
            <details class="fr-mt-3w">
              <summary class="fr-text--sm fr-link">
                Voir le tableau des données par département
              </summary>
              <div class="fr-table fr-mt-2w fr-table--sm">
                <table>
                  <caption class="fr-sr-only">
                    Simulations et aides par département
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Département</th>
                      <th scope="col" class="fr-text--right">Simulations</th>
                      <th scope="col" class="fr-text--right">Nationales</th>
                      <th scope="col" class="fr-text--right">Locales</th>
                      <th scope="col" class="fr-text--right">Total aides</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="dept in sortedDepartments" :key="dept.code">
                      <td>{{ dept.name }} ({{ dept.code }})</td>
                      <td class="fr-text--right">
                        {{ dept.simulations.toLocaleString("fr-FR") }}
                      </td>
                      <td class="fr-text--right">
                        {{ dept.nationalBenefits.toLocaleString("fr-FR") }}
                      </td>
                      <td class="fr-text--right">
                        {{ dept.localBenefits.toLocaleString("fr-FR") }}
                      </td>
                      <td class="fr-text--right">
                        {{ dept.totalBenefits.toLocaleString("fr-FR") }}
                      </td>
                    </tr>
                    <tr class="fr-text--bold">
                      <td>France entière (sans commune)</td>
                      <td class="fr-text--right">
                        {{ franceEntiere.simulations.toLocaleString("fr-FR") }}
                      </td>
                      <td class="fr-text--right">
                        {{
                          franceEntiere.nationalBenefits.toLocaleString("fr-FR")
                        }}
                      </td>
                      <td class="fr-text--right">0</td>
                      <td class="fr-text--right">
                        {{
                          franceEntiere.totalBenefits.toLocaleString("fr-FR")
                        }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </details>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue"

// ─── Types ──────────────────────────────────────────────────────────────────

interface DeptData {
  code: string
  name: string
  simulations: number
  nationalBenefits: number
  localBenefits: number
  localByType: Record<string, number>
  localBenefitNames: string[]
  totalBenefits: number
}

interface MapStats {
  departments: Array<{
    code: string
    name: string
    simulations: number
    nationalBenefits: number
    localBenefits: number
    localByType: Record<string, number>
    localBenefitNames: string[]
    totalBenefits: number
  }>
  franceEntiere: {
    simulations: number
    nationalBenefits: number
    localBenefits: number
    localByType: Record<string, number>
    totalBenefits: number
  }
  totals: {
    simulations: number
    benefits: number
    nationalBenefits: number
    localBenefitsTotal: number
  }
}

// ─── State ───────────────────────────────────────────────────────────────────

const loading = ref(true)
const error = ref<string | null>(null)
const mapSvg = ref<SVGSVGElement | null>(null)
const deptGroup = ref<SVGGElement | null>(null)

const departments = ref<DeptData[]>([])
const franceEntiere = ref({
  simulations: 0,
  nationalBenefits: 0,
  localBenefits: 0,
  localByType: {} as Record<string, number>,
  totalBenefits: 0,
})
const totals = ref({
  simulations: 0,
  benefits: 0,
  nationalBenefits: 0,
  localBenefitsTotal: 0,
})

// Mode de colorisation de la carte
type MapMode = "simulations" | "localBenefits"
const mapMode = ref<MapMode>("simulations")

const tooltip = ref({
  visible: false,
  x: 0,
  y: 0,
  name: "",
  simulations: 0,
  nationalBenefits: 0,
  localBenefits: 0,
  localByType: {} as Record<string, number>,
  localBenefitNames: [] as string[],
  totalBenefits: 0,
})

// ─── Labels des types d'institution pour l'affichage ──────────────────────────

const typeLabels: Record<string, { emoji: string; label: string }> = {
  region: { emoji: "🏛️", label: "Régionales" },
  departement: { emoji: "🏢", label: "Départementales" },
  commune: { emoji: "🏘️", label: "Communales" },
  epci: { emoji: "🏗️", label: "Intercommunales" },
  caf: { emoji: "👪", label: "CAF" },
  msa: { emoji: "🌾", label: "MSA" },
  autre: { emoji: "📋", label: "Autres" },
  europeen: { emoji: "🇪🇺", label: "Européennes" },
}

// ─── Computed ────────────────────────────────────────────────────────────────

const sortedDepartments = computed(() =>
  [...departments.value].sort((a, b) => b.simulations - a.simulations),
)

const maxSimulations = computed(() =>
  Math.max(...departments.value.map((d) => d.simulations), 1),
)
const maxLocalBenefits = computed(() =>
  Math.max(...departments.value.map((d) => d.localBenefits), 1),
)

// Palette bleue (simulations)
const blueScale = [
  "#eef3f9",
  "#b8cfe0",
  "#8fb5d3",
  "#5d9ac5",
  "#1f6dae",
  "#163d6b",
  "#0d1f38",
]
// Palette verte (aides locales)
const greenScale = [
  "#f0f7ee",
  "#c3e0bb",
  "#8fc98a",
  "#5aaf55",
  "#2e8b24",
  "#1a5c14",
  "#0a2e07",
]

const activeScale = computed(() =>
  mapMode.value === "simulations" ? blueScale : greenScale,
)

const legendSteps = computed(() => {
  const max =
    mapMode.value === "simulations"
      ? maxSimulations.value
      : maxLocalBenefits.value
  const scale = activeScale.value
  const label = mapMode.value === "simulations" ? "simulation" : "aide locale"
  return [
    { label: "0", color: scale[0] },
    { label: `1–${Math.round(max * 0.1)} ${label}s`, color: scale[1] },
    { label: `–${Math.round(max * 0.25)}`, color: scale[2] },
    { label: `–${Math.round(max * 0.5)}`, color: scale[3] },
    { label: `–${Math.round(max * 0.75)}`, color: scale[4] },
    { label: `–${Math.round(max * 0.9)}`, color: scale[5] },
    { label: `>${Math.round(max * 0.9)}`, color: scale[6] },
  ]
})

// ─── Couleur par département ──────────────────────────────────────────────────

function colorByRatio(value: number, max: number, scale: string[]): string {
  if (value === 0) return scale[0]
  const ratio = value / max
  if (ratio < 0.1) return scale[1]
  if (ratio < 0.25) return scale[2]
  if (ratio < 0.5) return scale[3]
  if (ratio < 0.75) return scale[4]
  if (ratio < 0.9) return scale[5]
  return scale[6]
}

function getDeptColor(dept: DeptData): string {
  if (mapMode.value === "simulations") {
    return colorByRatio(dept.simulations, maxSimulations.value, blueScale)
  }
  return colorByRatio(dept.localBenefits, maxLocalBenefits.value, greenScale)
}

// ─── Chargement données ───────────────────────────────────────────────────────

async function loadStats() {
  try {
    const res = await fetch("/api/stats/map")
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data: MapStats = await res.json()

    departments.value = data.departments.map((d) => ({
      ...d,
      name: d.name || `Département ${d.code}`,
    }))
    franceEntiere.value = data.franceEntiere
    totals.value = data.totals
  } catch (err) {
    console.error("[stats-map] Erreur chargement:", err)
    error.value = "Impossible de charger les données statistiques."
  } finally {
    loading.value = false
  }
}

// ─── Chargement carte SVG (CDN) ───────────────────────────────────────────────

async function loadMap() {
  if (!deptGroup.value) return

  try {
    // Carte France SVG légère depuis github.com/gregoiredavid/france-geojson (rendu SVG)
    // On utilise un fetch du SVG depuis unpkg ou jsdelivr
    const svgRes = await fetch(
      "https://cdn.jsdelivr.net/gh/gregoiredavid/france-geojson@master/departements-version-simplifiee.geojson",
    )
    if (!svgRes.ok) throw new Error("Impossible de charger la carte")
    const geojson = await svgRes.json()

    renderGeoJSON(geojson)
  } catch (err) {
    console.error("[stats-map] Erreur carte:", err)
    // Fallback : afficher un message à la place de la carte
    if (deptGroup.value) {
      const text = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
      )
      text.setAttribute("x", "425")
      text.setAttribute("y", "300")
      text.setAttribute("text-anchor", "middle")
      text.setAttribute("class", "stats-map-error-text")
      text.textContent = "Carte non disponible"
      deptGroup.value.appendChild(text)
    }
  }
}

// ─── Projection Lambert 93 → SVG ─────────────────────────────────────────────

function projectCoord(lon: number, lat: number): [number, number] {
  // Projection simple equirectangulaire adaptée France métropole
  // Bounding box France métropole : lon -5.5 à 9.6, lat 41.3 à 51.1
  const minLon = -5.5
  const maxLon = 9.6
  const minLat = 41.3
  const maxLat = 51.1

  const svgWidth = 700
  const svgHeight = 480
  const paddingX = 80
  const paddingY = 50

  const x = paddingX + ((lon - minLon) / (maxLon - minLon)) * svgWidth
  // Inverser Y (SVG y croît vers le bas, latitude vers le haut)
  const y =
    paddingY + svgHeight - ((lat - minLat) / (maxLat - minLat)) * svgHeight

  return [x, y]
}

function coordsToPath(geometry: any): string {
  const pathParts: string[] = []

  function ringToPath(ring: number[][]): string {
    return (
      ring
        .map(([lon, lat], i) => {
          const [x, y] = projectCoord(lon, lat)
          return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`
        })
        .join(" ") + " Z"
    )
  }

  if (geometry.type === "Polygon") {
    geometry.coordinates.forEach((ring: number[][]) => {
      pathParts.push(ringToPath(ring))
    })
  } else if (geometry.type === "MultiPolygon") {
    geometry.coordinates.forEach((polygon: number[][][]) => {
      polygon.forEach((ring: number[][]) => {
        pathParts.push(ringToPath(ring))
      })
    })
  }

  return pathParts.join(" ")
}

function renderGeoJSON(geojson: any) {
  if (!deptGroup.value) return

  const deptMap = new Map(departments.value.map((d) => [d.code, d]))

  for (const feature of geojson.features) {
    const code = feature.properties?.code || feature.properties?.CODE_DEPT
    if (!code) continue

    const pathStr = coordsToPath(feature.geometry)
    if (!pathStr) continue

    const deptData: DeptData = deptMap.get(code) || {
      code,
      name: feature.properties?.nom || `Département ${code}`,
      simulations: 0,
      nationalBenefits: totals.value.nationalBenefits,
      localBenefits: 0,
      localByType: {},
      localBenefitNames: [],
      totalBenefits: totals.value.nationalBenefits,
    }

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    path.setAttribute("d", pathStr)
    path.setAttribute("fill", getDeptColor(deptData))
    path.setAttribute("stroke", "#ffffff")
    path.setAttribute("stroke-width", "0.5")
    path.setAttribute("class", "dept-path")
    path.setAttribute("data-code", code)
    path.setAttribute("tabindex", "0")
    path.setAttribute("role", "button")
    path.setAttribute(
      "aria-label",
      `${deptData.name} : ${deptData.simulations} simulations`,
    )

    // Événements tooltip
    path.addEventListener("mouseenter", (e: MouseEvent) => {
      showTooltip(e, deptData)
      path.setAttribute("fill", lightenColor(getDeptColor(deptData)))
    })
    path.addEventListener("mouseleave", () => {
      hideTooltip()
      path.setAttribute("fill", getDeptColor(deptData))
    })
    path.addEventListener("mousemove", (e: MouseEvent) => {
      moveTooltip(e)
    })
    path.addEventListener("focus", (e: FocusEvent) => {
      const rect = (e.target as SVGPathElement).getBoundingClientRect()
      showTooltipFromRect(rect, deptData)
    })
    path.addEventListener("blur", hideTooltip)

    deptGroup.value.appendChild(path)
  }
}

function lightenColor(hex: string): string {
  // Éclaircir légèrement pour le hover
  const num = parseInt(hex.replace("#", ""), 16)
  const r = Math.min(255, (num >> 16) + 40)
  const g = Math.min(255, ((num >> 8) & 0xff) + 40)
  const b = Math.min(255, (num & 0xff) + 40)
  return `rgb(${r},${g},${b})`
}

function showTooltip(e: MouseEvent, dept: DeptData) {
  const svgRect = mapSvg.value?.getBoundingClientRect()
  if (!svgRect) return
  tooltip.value = {
    visible: true,
    x: e.clientX - svgRect.left + 12,
    y: e.clientY - svgRect.top - 10,
    name: dept.name,
    simulations: dept.simulations,
    nationalBenefits: dept.nationalBenefits,
    localBenefits: dept.localBenefits,
    localByType: dept.localByType ?? {},
    localBenefitNames: dept.localBenefitNames ?? [],
    totalBenefits: dept.totalBenefits,
  }
}

function showTooltipFromRect(rect: DOMRect, dept: DeptData) {
  const svgRect = mapSvg.value?.getBoundingClientRect()
  if (!svgRect) return
  tooltip.value = {
    visible: true,
    x: rect.left - svgRect.left + rect.width / 2,
    y: rect.top - svgRect.top,
    name: dept.name,
    simulations: dept.simulations,
    nationalBenefits: dept.nationalBenefits,
    localBenefits: dept.localBenefits,
    localByType: dept.localByType ?? {},
    localBenefitNames: dept.localBenefitNames ?? [],
    totalBenefits: dept.totalBenefits,
  }
}

function moveTooltip(e: MouseEvent) {
  const svgRect = mapSvg.value?.getBoundingClientRect()
  if (!svgRect) return
  tooltip.value.x = e.clientX - svgRect.left + 12
  tooltip.value.y = e.clientY - svgRect.top - 10
}

function hideTooltip() {
  tooltip.value.visible = false
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(async () => {
  await loadStats()
  await nextTick()
  await loadMap()
})
</script>

<style scoped>
.stats-kpi-card {
  background: var(--background-alt-blue-france);
  border-radius: 8px;
  text-align: center;
  padding: 1.5rem 1rem;
}

.stats-kpi-number {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-action-high-blue-france);
  line-height: 1.2;
}

.stats-kpi-label {
  color: var(--text-mention-grey);
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.stats-map-card {
  background: var(--background-elevated-grey);
  border-radius: 8px;
  position: relative;
  overflow: visible;
}

.stats-map-wrapper {
  position: relative;
  width: 100%;
}

.stats-map-svg {
  width: 100%;
  height: auto;
  display: block;
}

:deep(.dept-path) {
  cursor: pointer;
  transition: fill 0.15s ease;
}

:deep(.dept-path:focus) {
  outline: 2px solid var(--border-active-blue-france);
  outline-offset: 2px;
}

.stats-map-tooltip {
  position: absolute;
  background: var(--background-overlap-grey);
  border: 1px solid var(--border-default-grey);
  border-radius: 4px;
  padding: 0.5rem 0.75rem;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 10;
  white-space: nowrap;
  line-height: 1.6;
  max-width: 320px;
  font-size: 0.8125rem;
}

.tooltip-row {
  display: block;
  line-height: 1.5;
}

.tooltip-row--sims {
  font-size: 0.875rem;
  color: var(--text-action-high-blue-france);
}

.tooltip-row--total {
  border-top: 1px solid var(--border-default-grey);
  margin-top: 0.25rem;
  padding-top: 0.25rem;
  font-size: 0.8125rem;
}

.tooltip-divider {
  border: none;
  border-top: 1px solid var(--border-default-grey);
  margin: 0.3rem 0;
}

.tooltip-section-label {
  display: block;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-mention-grey);
  margin-bottom: 0.1rem;
}

.stats-kpi-card--local {
  background: var(--background-alt-green-tilleul-verveine);
}

.stats-map-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: var(--text-mention-grey);
}

.stats-map-legend {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.stats-map-legend-scale {
  display: flex;
  gap: 0.25rem;
  align-items: center;
  flex-wrap: wrap;
}

.stats-map-legend-step {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.stats-map-legend-color {
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

.domtom-label {
  font-size: 9px;
  fill: var(--text-mention-grey, #666);
}

.stats-map-error-text {
  font-size: 14px;
  fill: var(--text-mention-grey, #666);
}

details > summary {
  cursor: pointer;
}

.fr-text--right {
  text-align: right;
}

.tooltip-row--type {
  padding-left: 0.5rem;
  font-size: 0.75rem;
}

.tooltip-row--empty {
  color: var(--text-mention-grey);
}

.tooltip-section-label--local {
  margin-top: 0.25rem;
  color: var(--text-action-high-blue-france);
}

.tooltip-benefit-list {
  list-style: none;
  padding: 0;
  margin: 0.25rem 0 0 0;
  max-height: 120px;
  overflow-y: auto;
}

.tooltip-benefit-item {
  font-size: 0.6875rem;
  line-height: 1.4;
  padding: 0.1rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  white-space: normal;
}

.tooltip-benefit-item:last-child {
  border-bottom: none;
}

.tooltip-benefit-more {
  font-style: italic;
  color: var(--text-mention-grey);
}
</style>
