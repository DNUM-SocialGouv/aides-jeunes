import { assign, map } from "lodash-es"
import { capitalize } from "../../../../lib/utils.js"
import { APPOINTMENT_LABEL } from "../../../../lib/enums/cta.js"

import {
  formatDroitEstime,
  getBenefitImage,
} from "../../../../lib/benefits/details.js"

export function basicBenefitText(droit, parameters) {
  const droitEstime = formatDroitEstime(droit, parameters)

  if (droit.labelFunction) {
    return droit.labelFunction({ ...droit, legend: droitEstime.legend })
  }

  if (droitEstime.type === "bool") {
    return droit.label
  }
  if (droitEstime.unit === "séances") {
    return `${droit.label} : vous pouvez bénéficier de ${droitEstime.value} ${droitEstime.legend}`
  }

  return `${droit.label} pour un montant de ${droitEstime.value} ${droitEstime.legend}`
}

export function formatBenefits(benefits, parameters) {
  return map(benefits, function (droit) {
    let value = ""
    const droitEstime = formatDroitEstime(droit, parameters)

    if (droitEstime.type === "float") {
      value = `${droitEstime.value} ${droitEstime.legend}`
    }

    let ctaLink = ""
    let ctaLabel = ""
    if (droit.teleservice) {
      ctaLink = droit.teleservice
      ctaLabel = droit.is_appointment
        ? APPOINTMENT_LABEL
        : "Faire une demande en ligne"
    } else if (droit.form) {
      ctaLink = droit.form
      ctaLabel = "Accéder au formulaire papier"
    } else if (droit.instructions) {
      ctaLink = droit.instructions
      ctaLabel = "Accéder aux instructions"
    } else {
      ctaLink = droit.link
      ctaLabel = "Plus d'informations"
    }

    return assign({}, droit, {
      imgSrc: `/${getBenefitImage(droit)}`,
      montant: value,
      ctaLink: ctaLink,
      ctaLabel: ctaLabel,
      benefitLabel: capitalize(droit.label),
    })
  })
}
