export enum ErrorType {
  UnsupportedPhoneNumberFormat = "Unsupported phone number format",
  // Refus du fournisseur de SMS pour un numéro au format accepté mais non
  // joignable. Le libellé vient du fournisseur et arrive imbriqué dans le corps
  // de sa réponse : il se reconnaît par inclusion, pas par égalité.
  InvalidDestinationAddress = "Invalid destination address",
  PersistingFollowup = "Persisting followup error",
  MissingFollowupPhone = "Missing followup phone",
  MissingFollowupEmail = "Missing followup email",
  UnknownSurveyType = "Unknown survey type",
}

export enum ErrorStatus {
  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  UnprocessableEntity = 422,
  NotFound = 404,
  InternalServerError = 500,
}

export enum ErrorName {
  ValidationError = "ValidationError",
  SmsProviderError = "SmsProviderError",
  MattermostNotConfiguredError = "MattermostNotConfiguredError",
}

// Refus du fournisseur pour un numéro non joignable : l'usager qui réessaie
// obtient le même refus. Partagé par le service et le contrôleur, qui sans cela
// en donnent deux définitions divergentes.
export function isRejectedDestination(error: any): boolean {
  if (error?.name !== ErrorName.SmsProviderError) {
    return false
  }
  const message = typeof error?.message === "string" ? error.message : ""
  return message.includes(ErrorType.InvalidDestinationAddress)
}

// Conditions dues à la saisie de l'usager : une entrée irrecevable, pas une
// panne, et reproductible à chaque nouvelle tentative.
export function isUserInputError(error: any): boolean {
  return (
    error?.name === ErrorName.ValidationError ||
    error?.message === ErrorType.UnsupportedPhoneNumberFormat ||
    isRejectedDestination(error)
  )
}
