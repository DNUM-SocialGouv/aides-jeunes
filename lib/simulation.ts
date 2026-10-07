export const version = 18

// Réponses dont la valeur enregistrée a pu être perdue, et qui doivent alors
// être reposées plutôt que devinées : le taux d'incapacité fait varier l'AAH de
// plus de mille euros par mois.
//
// Attention avant d'allonger cette liste : la garde des résultats renvoie dans
// le parcours TOUTE simulation vivante à qui la réponse manque, migrée ou non.
// Un nom ajouté sans migration correspondante y renverrait aussitôt les
// simulations qui ne l'ont jamais eue. Une question nouvelle se traite comme
// `to-v15`, qui fabrique la réponse manquante et n'a besoin d'aucune garde.
export const fieldsToAnswerAgain = ["taux_incapacite"]

// `null` est ce que JSON écrit d'un NaN : la question a bien été posée, mais la
// valeur choisie est perdue. Une chaîne, elle, reste exploitable — OpenFisca
// l'accepte — et n'a pas à être écartée.
export function isUnusableAnswer(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "number" && !Number.isFinite(value))
  )
}
