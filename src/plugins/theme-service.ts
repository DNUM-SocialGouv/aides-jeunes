import BordeauxMetropole from "@/styles/themes/bordeaux-metropole.css?inline"
import LightBlue from "@/styles/themes/light-blue.css?inline"
import DefaultDsfr from "@/styles/themes/default-dsfr.css?inline"
import Soliguide from "@/styles/themes/soliguide.css?inline"
import VilleDeVannes from "@/styles/themes/ville-de-vannes.css?inline"
import * as Sentry from "@sentry/vue"
import { Theme, ThemeLabel } from "@/../lib/enums/themes.js"

const options = [
  {
    title: ThemeLabel.Default,
    label: Theme.Default,
    value: DefaultDsfr,
  },
  {
    title: ThemeLabel.LightBlue,
    label: Theme.LightBlue,
    value: LightBlue,
  },
  {
    title: ThemeLabel.BordeauxMetropole,
    label: Theme.BordeauxMetropole,
    value: BordeauxMetropole,
  },
  {
    title: ThemeLabel.Soliguide,
    label: Theme.Soliguide,
    value: Soliguide,
  },
  {
    title: ThemeLabel.UnivParisCite,
    label: Theme.UnivParisCite,
    value: DefaultDsfr,
  },
  {
    title: ThemeLabel.VilleDeVannes,
    label: Theme.VilleDeVannes,
    value: VilleDeVannes,
  },
]

const defaultTheme = options[0]

export default {
  install: (app) => {
    const styleElement = document.createElement("style")
    styleElement.textContent = defaultTheme.value
    document.head.appendChild(styleElement)

    app.config.globalProperties.$theme = {
      current: defaultTheme.label,
      options,
      update(newThemeLabel) {
        const match = options.find((option) => option.label === newThemeLabel)
        if (!match) {
          Sentry.captureMessage(`Invalid theme label ${newThemeLabel}`)
          return
        }
        this.current = newThemeLabel
        styleElement.textContent = match.value
      },
    }
  },
}
