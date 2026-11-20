import { NextFunction, Request, Response } from "express"

/*
 * Express 4 ignore la promesse renvoyée par un gestionnaire : le rejet d'un
 * gestionnaire `async` monté nu n'a personne pour le recevoir. La requête reste
 * pendante jusqu'au délai du client, et le processus signale un
 * `unhandledRejection`. Ce montage rend le rejet à la chaîne d'erreur d'Express.
 *
 * La signature est variadique : un gestionnaire `param` reçoit deux arguments
 * de plus — la valeur du paramètre et son nom. Ne propager que les trois
 * premiers les lui retirerait sans que rien ne le signale, ni au typage ni à
 * l'exécution. Les paramètres du reste ne comptent pas dans `length`, qui vaut
 * 3 : Express ne prendra donc pas l'enveloppe pour un middleware d'erreur.
 *
 * Ne couvre qu'un gestionnaire qui *renvoie* sa promesse. Celui qui en lance une
 * sans la rendre reste à découvert : c'est à lui, ou à ce qu'il appelle, de
 * rattraper.
 */
export function asyncHandler(
  handler: (
    req: Request,
    res: Response,
    next: NextFunction,
    ...rest: unknown[]
  ) => unknown,
) {
  return (
    req: Request,
    res: Response,
    next: NextFunction,
    ...rest: unknown[]
  ) => {
    try {
      // Express ignore cette promesse, mais la rendre permet d'attendre le
      // passage à `next` — sans quoi seul un appelant qui draine la file peut
      // observer l'issue. Elle ne rejette jamais : `.catch` la termine.
      return Promise.resolve(handler(req, res, next, ...rest)).catch(next)
    } catch (error) {
      // Un gestionnaire non asynchrone peut lever avant d'avoir rien renvoyé.
      next(error)
    }
  }
}
