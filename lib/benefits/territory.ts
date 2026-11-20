import { Situation } from "../types/situations.d.js"

type Menage = Situation["menage"]

/**
 * Une aide portée par une collectivité ne concerne que son territoire. La
 * correspondance entre le type d'institution et le champ décrivant la commune
 * de l'usager est la même partout : c'est elle qui décide de l'éligibilité
 * géographique des aides calculées en JavaScript, et de ce qu'il est inutile de
 * faire calculer à OpenFisca.
 */
export function isAttachedToInstitution(
  institution: { type?: string; code_insee?: string; code_siren?: string },
  menage: Menage,
): boolean {
  switch (institution?.type) {
    case "region":
      return menage?._region === institution.code_insee
    case "departement":
      return menage?._departement === institution.code_insee
    case "epci":
      return menage?._epci === institution.code_siren
    case "commune":
      return menage?.depcom === institution.code_insee
  }
  return false
}

const TERRITORIAL_TYPES = ["region", "departement", "epci", "commune"]

const SITUATION_FIELD = {
  region: "_region",
  departement: "_departement",
  epci: "_epci",
  commune: "depcom",
}

const INSTITUTION_FIELD = {
  region: "code_insee",
  departement: "code_insee",
  epci: "code_siren",
  commune: "code_insee",
}

/**
 * Vrai seulement lorsqu'on sait positivement que l'usager ne relève pas du
 * territoire de l'aide. Une institution non territoriale, un code manquant côté
 * institution, ou une commune dont l'enrichissement n'a pas fourni le
 * département, la région ou l'EPCI donnent faux : dans le doute, l'aide est
 * conservée et sera évaluée normalement.
 */
export function isOutOfTerritory(
  benefit: { institution?: any },
  menage: Menage,
): boolean {
  const institution = benefit?.institution
  const type = institution?.type

  if (!institution || !menage || !TERRITORIAL_TYPES.includes(type)) {
    return false
  }

  const expected = institution[INSTITUTION_FIELD[type]]
  const actual = menage[SITUATION_FIELD[type]]

  if (!expected || !actual) {
    return false
  }

  return expected !== actual
}
