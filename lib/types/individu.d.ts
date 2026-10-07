import { Scolarite } from "@lib/enums/scolarite.js"
import { Velo } from "../enums/velo.js"
import { Activite } from "@lib/enums/activite.js"
export interface Individu {
  id: string
  annee_etude?: string
  date_naissance?: string
  enfant_a_charge: any
  nationalite: any
  _role: string
  _firstName?: string
  salaire_net?: number
  statut_marital?: string
  activite?: Activite
  service_civique?: boolean
  scolarite?: Scolarite
  _contratAlternance?: string
  stagiaire?: boolean
  groupe_specialites_formation?: any
  mention_baccalaureat?: string
  handicap?: boolean
  taux_incapacite?: number
  _interetsAidesVelo?: Velo[]
  _interetUnivParisCite?: boolean
}

export interface IndividuGenerator {
  [id: string]: {
    src?: string
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    fn: Function
  }
}
