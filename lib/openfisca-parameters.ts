import { OpenfiscaParameters } from "./types/parameters.js"

// Valeurs servies tant qu'OpenFisca n'a pas répondu, côté serveur comme côté
// navigateur. Un paramètre absent n'est pas neutre : les options de la question
// du taux d'incapacité se calculent à partir de l'un d'eux et vaudraient NaN,
// que JSON écrit `null` — cette valeur s'enregistrerait à la place de la
// réponse, définitivement.
//
// Ce sont des valeurs figées, servies à titre transitoire : `computeParameter`
// signale à Sentry chaque recours à cette liste. Certaines sont affichées telles
// quelles — le taux du livret A apparaît dans la légende du LEP : les laisser
// vieillir revient à écrire un chiffre faux à l'écran. Relevées sur OpenFisca,
// applicables au 2026-08.
export const parametersList: OpenfiscaParameters = {
  "prestations_sociales.education.carte_des_metiers.age_maximal": 26,
  "prestations_sociales.prestations_etat_de_sante.invalidite.aah.taux_capacite.taux_incapacite": 0.8,
  "taxation_capital.epargne.livret_a.taux": 0.015,
  "marche_travail.salaire_minimum.smic.smic_b_horaire": 12.31,
  "marche_travail.salaire_minimum.smic.nb_heures_travail_mensuel": 151.67,
}
