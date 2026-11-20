import { isAttachedToInstitution } from "./territory.js"
import dayjs from "dayjs"
import { datesGenerator } from "../dates.js"
import { filterByInterestFlag } from "./filter-interest-flag.js"
import ScolariteCategories from "../scolarite.js"

import { Activite } from "../enums/activite.js"
import { Scolarite } from "../enums/scolarite.js"
import { Situation } from "../types/situations.js"
import { Conditions } from "../types/benefits.js"
import { BenefitCatalog } from "../../data/types/generator.d.js"

const testRSARecipient = ({ openfiscaResponse, periods }): boolean => {
  const rsa = openfiscaResponse.familles._.rsa[periods.thisMonth.id]
  return rsa > 1
}

const includesAndExcludesCondition = (condition, value) => {
  const includes =
    !(condition && condition?.includes?.length) ||
    condition.includes.includes(value)
  const excludes =
    !(condition && condition?.excludes?.length) ||
    !condition.excludes.includes(value)
  return includes && excludes
}
const PROFILE_STRATEGY = {
  apprenti: ({ situation }: { situation: Situation }): boolean => {
    return situation.demandeur?._contratAlternance === Activite.Apprenti
  },
  beneficiaire_rsa: (data) => {
    return testRSARecipient(data)
  },
  chomeur: ({ situation }: { situation: Situation }): boolean => {
    return situation.demandeur?.activite === Activite.Chomeur
  },
  etudiant: ({ situation }: { situation: Situation }): boolean => {
    return situation.demandeur?.activite === Activite.Etudiant
  },
  inactif: ({ situation }: { situation: Situation }): boolean => {
    return situation.demandeur?.activite === Activite.Inactif
  },
  independant: ({ situation }: { situation: Situation }): boolean => {
    return situation.demandeur?.activite === Activite.Independant
  },
  enseignement_superieur: ({
    situation,
  }: {
    situation: Situation
  }): boolean => {
    return situation.demandeur?.scolarite === Scolarite.EnseignementSuperieur
  },
  collegien: ({ situation }: { situation: Situation }): boolean => {
    return situation.demandeur?.scolarite === Scolarite.College
  },
  lyceen: ({ situation }: { situation: Situation }): boolean => {
    return situation.demandeur?.scolarite === Scolarite.Lycee
  },
  professionnalisation: ({ situation }: { situation: Situation }): boolean => {
    return (
      situation.demandeur?._contratAlternance === Activite.Professionnalisation
    )
  },
  salarie: ({ situation }: { situation: Situation }): boolean => {
    return situation.demandeur?.activite === Activite.Salarie
  },
  service_civique: ({ situation }: { situation: Situation }): boolean => {
    return situation.demandeur?.service_civique === true
  },
  stagiaire: ({ situation }: { situation: Situation }): boolean => {
    return situation.demandeur?.stagiaire === true
  },
  situation_handicap: ({ situation }: { situation: Situation }): boolean => {
    return situation.demandeur?.handicap === true
  },
  parent: ({ situation }: { situation: Situation }): boolean => {
    return situation?.enfants && situation.enfants.length > 0
  },
}

const OPERATOR = {
  ">": (a: number, b: number) => a > b,
  ">=": (a: number, b: number) => a >= b,
  "=": (a: number, b: number) => a === b,
  "<": (a: number, b: number) => a < b,
  "<=": (a: number, b: number) => a <= b,
}

const COMMUNE_PARAMETERS = {
  regions: "_region",
  departements: "_departement",
  communes: "depcom",
  epcis: "_epci",
  codes_postaux: "_codePostal",
}

export function testGeographicalEligibility(
  condition: any,
  { situation }: { situation: Situation },
): boolean {
  // Pas de contrainte géographique
  if (!condition.values || condition.values.length === 0) {
    return true
  }

  const communeParameter = COMMUNE_PARAMETERS[condition.type]

  return (
    situation.menage &&
    condition.values.includes(situation.menage[communeParameter])
  )
}

export function testExcludedEpcis(
  condition: any,
  { situation }: { situation: Situation },
): boolean {
  if (!condition.values || condition.values.length === 0) {
    return true
  }
  const situationEpci = situation.menage?._epci
  if (!situationEpci) {
    return true
  }
  return !condition.values.includes(situationEpci)
}

export const CONDITION_STRATEGY: Conditions = {
  boursier: {
    test: (_, { openfiscaResponse, periods }) => {
      return openfiscaResponse.individus.demandeur.boursier?.[
        periods.thisMonth.id
      ]
    },
    extra: [
      {
        id: "boursier",
        entity: "individus",
        type: "bool",
        openfiscaPeriod: "thisMonth",
      },
    ],
  },
  formation_sanitaire_social: {
    test: (_, { situation }: { situation: Situation }) => {
      return (
        situation.demandeur?.groupe_specialites_formation ===
        ScolariteCategories.groupeSpecialitesFormation
          .specialites_plurivalentes_sanitaires_et_sociales.value
      )
    },
  },
  mention_baccalaureat: {
    test: (condition, { situation }: { situation: Situation }) => {
      return condition.values.includes(
        situation.demandeur?.mention_baccalaureat,
      )
    },
  },
  age: {
    test: (condition, { age }) => {
      return OPERATOR[condition.operator](age, condition.value)
    },
  },
  attached_to_institution: {
    test: (
      _,
      {
        situation,
      }: {
        situation: Situation
      },
      benefit,
    ): boolean => {
      return isAttachedToInstitution(benefit.institution, situation.menage)
    },
  },
  not: {
    test: (condition, props) => {
      return !CONDITION_STRATEGY[condition.value.type].test(
        condition.value,
        props,
      )
    },
  },
  regions: {
    test: testGeographicalEligibility,
  },
  codes_postaux: {
    test: testGeographicalEligibility,
  },
  departements: {
    test: testGeographicalEligibility,
  },
  communes: {
    test: testGeographicalEligibility,
  },
  epcis: {
    test: testGeographicalEligibility,
  },
  excluded_epcis: {
    test: testExcludedEpcis,
  },
  annee_etude: {
    test: (condition, { situation }: { situation: Situation }) => {
      return condition.values.includes(situation.demandeur?.annee_etude)
    },
  },
  regime_securite_sociale: {
    test: (condition, { openfiscaResponse }) => {
      return includesAndExcludesCondition(
        condition,
        openfiscaResponse.individus.demandeur.regime_securite_sociale,
      )
    },
  },
  statut_occupation_logement: {
    test: (condition, { situation }) => {
      return includesAndExcludesCondition(
        condition,
        situation.menage.statut_occupation_logement,
      )
    },
  },
  difficultes_acces_ou_frais_logement: {
    test: (_, { situation }) => {
      return situation.menage._difficultes_acces_ou_frais_logement === true
    },
  },
  agence_travail_temporaire: {
    test: (_, { situation }) => {
      return situation.demandeur?._agence_travail_temporaire === true
    },
  },
  quotient_familial: {
    test: (condition, { openfiscaResponse, periods }) => {
      const rfr = openfiscaResponse.foyers_fiscaux._.rfr[periods.fiscalYear.id]
      const nbptr =
        openfiscaResponse.foyers_fiscaux._.nbptr[periods.fiscalYear.id] || 1
      const periodDivider = condition.period === "month" ? 12 : 1
      const quotient_familial = rfr / nbptr / periodDivider
      return OPERATOR[condition.operator](quotient_familial, condition.value)
    },
    extra: [
      {
        id: "rfr",
        entity: "foyers_fiscaux",
        type: "float",
        openfiscaPeriod: "fiscalYear",
      },
      {
        id: "nbptr",
        entity: "foyers_fiscaux",
        type: "float",
        openfiscaPeriod: "fiscalYear",
      },
    ],
  },
  beneficiaire_rsa: {
    test: (_, data) => {
      return testRSARecipient(data)
    },
    extra: [
      {
        id: "rsa",
        entity: "familles",
        type: "float",
        openfiscaPeriod: "thisMonth",
      },
    ],
  },
  taux_incapacite: {
    test: (condition, { situation }: { situation: Situation }) => {
      const taux_incapacite = situation.demandeur?.taux_incapacite || 0
      return OPERATOR[condition.operator](taux_incapacite, condition.value)
    },
  },
  enfants_eligibles: {
    test: (condition, { situation }: { situation: Situation }) => {
      if (!situation.enfants || situation.enfants.length === 0) {
        return false
      }

      let enfantsEligibles = situation.enfants
      if (condition.age_min !== undefined || condition.age_max !== undefined) {
        const dateDeValeur = dayjs(situation.dateDeValeur)
        enfantsEligibles = situation.enfants.filter((enfant) => {
          const ageEnfant = dateDeValeur.diff(
            dayjs(enfant.date_naissance),
            "year",
          )
          return (
            ageEnfant >= (condition?.age_min || 0) &&
            ageEnfant <= (condition?.age_max || 99)
          )
        })
      }

      return OPERATOR[condition.operator](
        enfantsEligibles.length,
        condition.value,
      )
    },
  },
}

function testConditions(conditions, data, benefit) {
  if (!conditions) {
    return true
  }

  return conditions.every((condition) =>
    CONDITION_STRATEGY[condition.type].test(condition, data, benefit),
  )
}

export function testProfileEligibility(benefit, data) {
  return (
    benefit.profils === undefined ||
    benefit.profils.length === 0 ||
    benefit.profils.some((profil) => {
      return (
        PROFILE_STRATEGY[profil.type](data) &&
        testConditions(profil.conditions, data, benefit)
      )
    })
  )
}

export function computeJavascriptBenefits(
  benefits: BenefitCatalog,
  situation: Situation,
  openfiscaResponse,
) {
  const age = dayjs(situation.dateDeValeur).diff(
    situation.demandeur?.date_naissance,
    "year",
  )
  const periods = datesGenerator(situation.dateDeValeur)
  const data = { situation, openfiscaResponse, periods, age }

  benefits.all
    .filter(
      (benefit) =>
        benefit.source === "javascript" &&
        filterByInterestFlag(benefit, situation.demandeur),
    )
    .forEach(function (benefit) {
      const profileEligibility = testProfileEligibility(benefit, data)

      const generalConditionsEligibility = testConditions(
        benefit.conditions_generales,
        data,
        benefit,
      )

      const montant = benefit.montant

      const eligibility = profileEligibility && generalConditionsEligibility

      const result =
        benefit.type === "float" ? (eligibility ? montant : 0) : eligibility

      openfiscaResponse.individus.demandeur[benefit.id] = {
        [periods.thisMonth.id]: result,
      }
    })
}
