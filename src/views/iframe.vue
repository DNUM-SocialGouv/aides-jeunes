<script setup lang="ts">
import { computed, getCurrentInstance, onMounted, ref, watch } from "vue"
import { Theme } from "@lib/enums/themes"

// Thèmes à ne pas exposer publiquement dans le listing d'intégration
const excludedThemes: string[] = [Theme.UnivParisCite]

const $theme = getCurrentInstance()?.appContext.config.globalProperties.$theme
const availableThemes = computed(() =>
  ($theme?.options ?? []).filter(
    (option) => !excludedThemes.includes(option.label),
  ),
)

const selectedTheme = ref(Theme.Default)
const options = ref(["data-from-home", "data-with-logo"])
const scriptPath = "/documents/iframe-integration.js"
const contactEmail = process.env.VITE_CONTACT_EMAIL
const fullScript = computed(() => {
  return `<script src="${
    process.env.VITE_BASE_URL
  }${scriptPath}" ${options.value.join(" ")} data-theme="${
    selectedTheme.value
    // eslint-disable-next-line no-useless-escape
  }"><\/script>`
})

const setIframeContainer = () => {
  const externalScript = document.createElement("script")
  externalScript.setAttribute("src", scriptPath)
  options.value.forEach((option) => externalScript.setAttribute(option, ""))
  externalScript.setAttribute("data-theme", selectedTheme.value)
  const dest = document.getElementById("dest")
  if (dest) {
    dest.innerHTML = ""
    dest.appendChild(externalScript)
  }
}

onMounted(setIframeContainer)

watch(options, setIframeContainer)

watch(selectedTheme, () => {
  setIframeContainer()
})
</script>

<template>
  <article class="fr-article">
    <h1>Intégrez le simulateur sur votre site&nbsp;!</h1>
    <p
      >Notre simulateur est intégrable de manière transparente en ajoutant une
      simple ligne de code à votre page Web.</p
    >
    <p>
      Le script de son intégration est accessible
      <a
        href="https://github.com/betagouv/aides-jeunes/blob/main/iframes/iframe-integration.js"
        target="_blank"
        >sur le dépôt hébergeant notre code </a
      >.
    </p>
    <h2>Code d'intégration</h2>
    <p>Voici le code à copier-coller sur votre site&nbsp;:</p>

    <p
      ><code class="fr-text--sm fr-p-1v">{{ fullScript }}</code></p
    >
    <div class="fr-form-group">
      <fieldset class="fr-fieldset fr-fieldset--inline">
        <legend
          id="checkboxes-inline-legend"
          class="fr-fieldset__legend fr-text--regular"
        >
          Plusieurs options s'offrent à vous pour personnaliser l'affichage du
          simulateur&nbsp;:
        </legend>
        <div class="fr-fieldset__content">
          <div class="fr-checkbox-group">
            <input
              id="data-from-home"
              v-model="options"
              type="checkbox"
              checked="true"
              value="data-from-home"
            />
            <label for="data-from-home" class="fr-label"
              >Afficher l'écran d'accueil</label
            >
          </div>
          <div class="fr-checkbox-group">
            <input
              id="data-with-logo"
              v-model="options"
              type="checkbox"
              checked="true"
              value="data-with-logo"
            />
            <label for="data-with-logo" class="fr-label"
              >Afficher les logos institutionnels</label
            >
          </div>
          <div class="fr-checkbox-group">
            <input
              id="data-eager"
              v-model="options"
              type="checkbox"
              value="data-eager"
            />
            <label for="data-eager" class="fr-label"
              >Charger le simulateur dès l'ouverture de la page</label
            >
          </div>
        </div>
      </fieldset>
      <p class="fr-hint-text">
        Par défaut, le simulateur n'est chargé qu'à l'approche du champ de
        vision : les visiteurs qui ne descendent pas jusqu'à lui ne le
        téléchargent pas. Cochez la dernière option si vous préférez qu'il soit
        chargé dès l'ouverture de la page.
      </p>
      <fieldset class="fr-fieldset fr-fieldset--inline">
        <legend
          id="radio-group-inline-legend"
          class="fr-fieldset__legend fr-text--regular"
        >
          Différents thèmes couleur sont également disponibles&nbsp;:
        </legend>
        <div class="fr-row">
          <div
            v-for="(option, index) in availableThemes"
            :key="index"
            class="fr-radio-group fr-radio-rich fr-mb-2w fr-mt-1w"
          >
            <input
              :id="option.label"
              v-model="selectedTheme"
              type="radio"
              :value="option.label"
              :checked="selectedTheme === option.label"
            />
            <label :for="option.label" class="fr-label">{{
              option.title
            }}</label>
          </div>
        </div>
      </fieldset>
    </div>
    <h2>Prévisualisation</h2>

    <div id="dest" class="fr-col-11 fr-m-auto"></div>

    <h2>Customisation de l'iframe</h2>
    <p
      >Si vous voulez intégrer cette iframe mais que vous souhaitez que nous y
      apportions des modifications spécifiques, vous pouvez contacter l'équipe
      directement à cette adresse
      <a :href="`mailto:${contactEmail}`">{{ contactEmail }}</a
      >.<br />Merci !
    </p>
  </article>
</template>
