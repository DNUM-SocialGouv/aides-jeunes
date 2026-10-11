import { cloneDeep, difference, filter, forEach, pickBy } from "lodash-es"

import common from "./common.js"
import buildOpenFiscaIndividu from "./individu/index.js"
import { buildOpenFiscaMenage } from "./menage/index.js"

import propertyMove from "./property-move.js"
import last3MonthsDuplication from "./last3-months-duplication.js"
import { filterByInterestFlag } from "../../../../lib/benefits/filter-interest-flag.js"
import { isOutOfTerritory } from "../../../../lib/benefits/territory.js"

import SituationMethods from "../../../../lib/situation.js"
import { Situation } from "../../../../lib/types/situations.js"

import {
  OpenfiscaMapping,
  Menage,
  FoyersFiscaux,
} from "../../../types/openfisca.js"

export function dispatchIndividuals(situation: Situation): OpenfiscaMapping {
  const individus = mapIndividus(situation)

  const familles: any = { _: situation.famille }
  const foyers_fiscaux: FoyersFiscaux = {
    _: {
      declarants: [],
      personnes_a_charge: [],
    },
  }
  const menages: Menage = { _: buildOpenFiscaMenage(situation) }

  const demandeur = SituationMethods.getDemandeur(situation)
  const demandeurId = demandeur?.id

  familles._.parents = [demandeurId]
  menages._.personne_de_reference = [demandeurId]

  const aCharge =
    demandeur.enfant_a_charge &&
    Object.keys(demandeur.enfant_a_charge).length &&
    demandeur.enfant_a_charge[Object.keys(demandeur.enfant_a_charge)[0]]

  if (aCharge) {
    const parent1 = {
      id: "parent1",
    }
    individus[parent1.id] = { ...parent1, id: undefined }
    familles.parents = { parents: [parent1.id], enfants: [] }
    foyers_fiscaux._.declarants.push(parent1.id)
    menages.parents = {
      personne_de_reference: [parent1.id],
      enfants: [],
    }

    if (situation.parents?._situation == "en_couple") {
      const parent2 = {
        id: "parent2",
      }
      individus[parent2.id] = { ...parent2, id: undefined }
      familles.parents.parents.push(parent2.id)
      foyers_fiscaux._.declarants.push(parent2.id)
      menages.parents.conjoint = [parent2.id]
    }

    foyers_fiscaux._.personnes_a_charge.push(demandeurId)
  } else {
    foyers_fiscaux._.declarants.push(demandeurId)
  }

  const conjoint = SituationMethods.getConjoint(situation)
  const conjointId = conjoint?.id
  if (conjointId) {
    familles._.parents.push(conjointId)
    menages._.conjoint = [conjointId]

    if (aCharge) {
      foyers_fiscaux[conjointId] = {
        declarants: [conjointId],
      }
    } else {
      foyers_fiscaux._.declarants.push(conjointId)
    }
  }

  const enfants = SituationMethods.getEnfants(situation)
  const validEnfants = filter(enfants, function (enfant) {
    return common.isIndividuValid(enfant, situation)
  })
  const enfantIds = validEnfants.map(function (enfant) {
    return enfant.id
  })
  familles._.enfants = enfantIds
  foyers_fiscaux._.personnes_a_charge =
    foyers_fiscaux._.personnes_a_charge.concat(enfantIds)
  menages._.enfants = enfantIds

  return {
    individus: individus,
    familles,
    foyers_fiscaux,
    menages,
  }
}

function setNonInjected(testCase, prestations, periods, value) {
  forEach(prestations, function (definition, prestationName) {
    forEach(testCase[definition.entity], function (entity) {
      entity[prestationName] = entity[prestationName] || {}
      forEach(periods, function (period) {
        if (value === undefined) {
          delete entity[prestationName][period]
        } else {
          entity[prestationName][period] =
            entity[prestationName][period] || value
        }
      })
    })
  })
}

function mapIndividus(situation) {
  const individus = filter(
    SituationMethods.getIndividusSortedParentsFirst(situation),
    function (individu) {
      return common.isIndividuValid(individu, situation)
    },
  )
  return individus
    .map(function (individu) {
      return buildOpenFiscaIndividu(individu, situation)
    })
    .reduce(function (accum, individu) {
      accum[individu.id] = individu
      delete individu.id
      return accum
    }, {})
}

export function giveValueToRequestedVariables(
  testCase,
  prestations,
  periods,
  value,
) {
  if (!(periods instanceof Array)) {
    periods = [periods]
  }

  forEach(prestations, function (definition, prestationName) {
    forEach(testCase[definition.entity], function (entity) {
      entity[prestationName] = entity[prestationName] || {}
      forEach(periods, function (period) {
        if (
          typeof entity[prestationName][period] !== "undefined" &&
          entity[prestationName][period] !== null
        ) {
          return
        }
        if (value === undefined) {
          delete entity[prestationName][period]
        } else {
          entity[prestationName][period] = value
        }
      })
    })
  })
}

// Use heuristics to pass functional tests
// Complexity may be added in the future in the application (new questions to ask)
export function applyHeuristicsAndFix(testCase, sourceSituation) {
  const periods = common.getPeriods(sourceSituation.dateDeValeur)
  const demandeur = sourceSituation.demandeur
  const parents = sourceSituation.parents

  const aCharge = demandeur.enfant_a_charge?.[periods.thisYear]

  testCase.foyers_fiscaux._.nb_pac = {
    [periods.fiscalYear]:
      testCase.foyers_fiscaux._.declarants.length +
      testCase.foyers_fiscaux._.personnes_a_charge.length,
  }

  if (aCharge) {
    if (demandeur.bourse_criteres_sociaux_base_ressources_parentale) {
      testCase.foyers_fiscaux._.rbg = {
        [periods.fiscalYear]:
          demandeur.bourse_criteres_sociaux_base_ressources_parentale,
      }
    }
    if (parents.rfr) {
      testCase.foyers_fiscaux._.rfr = {
        [periods.fiscalYear]: parents.rfr,
      }
      testCase.foyers_fiscaux._.rni = {
        [periods.fiscalYear]: parents.rfr,
      }
    }
    if (parents.nbptr) {
      testCase.foyers_fiscaux._.nbptr = {
        [periods.fiscalYear]: parents.nbptr,
      }
    }
  }

  return testCase
}

export function buildOpenFiscaRequest(sourceSituation) {
  const situation = cloneDeep(sourceSituation)

  const testCase = dispatchIndividuals(situation)

  // Variables stored to properly restore UI should not be sent to OpenFisca
  forEach(testCase, (items) => {
    forEach(items, (item) => {
      const propsToDelete = Object.keys(item).filter((i) => i.startsWith("_"))
      propsToDelete.forEach(function (propertyName) {
        delete item[propertyName]
      })
    })
  })

  // Move properties to its group (familles, foyers_fiscaux) define in definition.js
  propertyMove.movePropertyValuesToGroupEntity(testCase)

  const periods = common.getPeriods(situation.dateDeValeur)
  const requestedVariables = { ...common.requestedVariables }
  const prestationsFinancieres = pickBy(
    requestedVariables,
    function (definition: any) {
      return (
        definition.type === "float" && definition.openfiscaPeriod === "month"
      )
    },
  )

  setNonInjected(
    testCase,
    prestationsFinancieres,
    difference(periods.last12Months, periods.last3Months),
    0,
  )

  const prestationsFinancieresAtZeroRecently = pickBy(
    requestedVariables,
    function (definition: any) {
      return (
        definition.type === "float" &&
        definition.setToZeroRecently &&
        definition.openfiscaPeriod === "month"
      )
    },
  )

  setNonInjected(
    testCase,
    prestationsFinancieresAtZeroRecently,
    periods.last3Months,
    0,
  )
  last3MonthsDuplication(testCase, situation.dateDeValeur)

  // Une aide portée par une collectivité dont l'usager ne relève pas ne peut
  // pas lui être due : la demander à OpenFisca fait calculer son arbre de
  // dépendances pour un résultat nul.
  const prestationsWithInterest: Record<string, any> = pickBy(
    requestedVariables,
    function (definition) {
      return (
        filterByInterestFlag(definition, situation.demandeur) &&
        !isOutOfTerritory(definition, situation.menage)
      )
    },
  )

  const openfiscaPeriods: Set<string> = new Set()
  Object.values(prestationsWithInterest).forEach((definition) => {
    openfiscaPeriods.add(definition.openfiscaPeriod)
  })

  openfiscaPeriods.forEach((value) => {
    const prestations = pickBy(prestationsWithInterest, function (definition) {
      return definition.openfiscaPeriod === value
    })

    giveValueToRequestedVariables(testCase, prestations, periods[value], null)
  })

  // Force RFR to be either present or restitued by OpenFisca
  const initialRFRValue = testCase.foyers_fiscaux._?.rfr?.[periods.fiscalYear]
  const newRFRValue = initialRFRValue !== undefined ? initialRFRValue : null
  if (testCase.foyers_fiscaux._.rfr) {
    testCase.foyers_fiscaux._.rfr[periods.fiscalYear] = newRFRValue
  } else {
    testCase.foyers_fiscaux._.rfr = { [periods.fiscalYear]: newRFRValue }
  }

  return applyHeuristicsAndFix(testCase, sourceSituation)
}

export default {
  dispatchIndividuals,
  giveValueToRequestedVariables,
  applyHeuristicsAndFix,
  buildOpenFiscaRequest,
}
