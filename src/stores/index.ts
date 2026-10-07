import { defineStore } from "pinia"
import dayjs from "dayjs"
import { version } from "@lib/simulation.js"
import { parametersList } from "@lib/openfisca-parameters.js"
import { datesGenerator } from "@lib/dates.js"
import { generateAllSteps } from "@lib/state/generator.js"
import { getAnswer, isStepAnswered, storeAnswer } from "@lib/answers.js"
import { categoriesRnc, patrimoineTypes } from "@lib/resources.js"
import isEqual from "lodash.isequal"
import axios from "axios"
import { generateSituation } from "@lib/situations.js"
import ABTestingService from "@/plugins/ab-testing-service.js"
import storageService from "@/lib/storage-service.js"
import { useThemeStore } from "@/stores/theme.js"
import {
  Calculs,
  PersistedStore,
  Patrimoine,
  Resultats,
  Simulation,
  Store,
} from "@lib/types/store.d.js"
import { Answer } from "@lib/types/answer.d.js"
import { SimulationStatus } from "@lib/enums/simulation.js"
import { StatutOccupationLogement } from "@lib/enums/logement.js"
import * as Sentry from "@sentry/vue"

function defaultCalculs(): Calculs {
  return {
    resultats: {
      _id: undefined,
      droitsEligibles: null,
      droitsInjectes: null,
    },
    dirty: false,
    error: false,
    exception: false,
    updating: false,
  }
}

function defaultStore(): Store {
  const now = dayjs().format()

  return {
    simulationId: null,
    simulation: {
      answers: {
        all: [],
        current: [],
      },
      dateDeValeur: new Date(),
      version,
      simulationToken: undefined,
      status: SimulationStatus.New,
    },
    message: {
      text: null,
      counter: null,
    },
    debug: false,
    error: false,
    access: {
      fetching: false,
      forbidden: false,
    },
    calculs: defaultCalculs(),
    dates: datesGenerator(now),
    title: null,
    modalState: null,
    saveSituationError: null,
    // Les paramètres partent des valeurs de repli — celles-là mêmes que le
    // serveur sert quand OpenFisca ne répond pas — et sont remplacés dès que la
    // requête aboutit. Un dictionnaire vide n'est pas une absence sans
    // conséquence : les options d'une question calculée à partir d'un paramètre
    // vaudraient NaN, et cette valeur s'enregistrerait comme réponse.
    openFiscaParameters: { ...parametersList },
    recapEmailState: undefined,
    recapPhoneState: undefined,
    external_id: undefined,
    followup: undefined,
  }
}

function getPersitedStateProperties(
  state: Store,
  save = false,
): PersistedStore {
  const persistedStoreData: PersistedStore = {
    simulationId: state.simulationId,
    simulation: state.simulation,
    calculs: state.calculs || defaultCalculs(),
    recapEmailState: state.recapEmailState,
    recapPhoneState: state.recapPhoneState,
  }
  if (!save) {
    persistedStoreData.dates = datesGenerator(state.simulation.dateDeValeur)
  }

  return persistedStoreData
}

function restoreLocal() {
  let state = storageService.session.getItem("store")
  if (!state || !state.simulation || !state.simulation.dateDeValeur) {
    state = defaultStore()
  }

  return getPersitedStateProperties(state)
}

export function persistDataOnSessionStorage({
  after,
  store,
  name,
}: {
  after: (callback: () => void) => void
  store: Store
  name: string
}) {
  after(() => {
    if (name === "initialize") {
      return
    }
    storageService.session.setItem(
      "store",
      getPersitedStateProperties(store, true),
    )
  })
}

export const useStore = defineStore("store", {
  state: () => defaultStore(),
  getters: {
    passSanityCheck(): boolean {
      return Boolean(
        this.situation.demandeur && this.situation.demandeur.date_naissance,
      )
    },
    getDebug(): boolean {
      return this.debug
    },
    peopleParentsFirst(): any[] {
      return []
        .concat(
          this.situation.demandeur,
          this.situation.conjoint,
          this.situation.enfants,
        )
        .filter((individu) => individu)
    },
    getAllSteps(): any[] {
      return generateAllSteps(this.situation, this.openFiscaParameters)
    },
    getAllAnsweredSteps(): any[] {
      const allSteps = this.getAllSteps.filter(
        (step) => step.path !== "/simulation/resultats" && step.isActive,
      )
      return allSteps.filter((step) =>
        isStepAnswered(this.simulation.answers.all, step),
      )
    },
    lastUnansweredStep(): any {
      const allSteps = this.getAllSteps.filter(
        (step) => step.path !== "/simulation/resultats" && step.isActive,
      )
      return allSteps.find(
        (step) => !isStepAnswered(this.simulation.answers.all, step),
      )
    },
    ressourcesYearMinusTwoCaptured() {
      const yearMinusTwo = this.dates.fiscalYear.id
      const januaryYearMinusTwo = this.dates.fiscalYear12Months[0].id
      return this.peopleParentsFirst.some((individu: any) => {
        return categoriesRnc.reduce((hasYm2RessourcesAccum, categorieRnc) => {
          if (!individu[categorieRnc.id]) {
            return hasYm2RessourcesAccum
          }

          return (
            hasYm2RessourcesAccum ||
            typeof individu[categorieRnc.id][yearMinusTwo] == "number" ||
            typeof individu[categorieRnc.id][januaryYearMinusTwo] == "number"
          )
        }, false)
      })
    },
    isProprietaireAvecPretEnCours(): boolean {
      const menage = this.situation.menage
      const isProprietaire = [
        StatutOccupationLogement.PrimoAccedant,
        StatutOccupationLogement.Proprietaire,
      ].includes(menage.statut_occupation_logement)
      return isProprietaire && menage.loyer > 0
    },
    isHebergeParticipeFrais(): boolean {
      const menage = this.situation.menage
      return (
        menage.statut_occupation_logement ===
          StatutOccupationLogement.LogeGratuitement &&
        menage.participation_frais
      )
    },
    /* This function returns
     * - false if demandeur has not declared a patrimoine or its value is zero
     * - true
     */
    hasPatrimoine(): boolean {
      return patrimoineTypes.some(
        (ressource) =>
          this.situation?.demandeur[ressource.id] &&
          Object.values(this.situation?.demandeur[ressource.id]).some(
            (value) => value,
          ),
      )
    },
    fetchRepresentation() {
      return (representation: string, simulationId: string) => {
        return axios
          .get(
            `/api/simulation/${
              simulationId || this.simulationId
            }/${representation}`,
            { headers: this.authHeaders },
          )
          .then((response) => response.data)
      }
    },
    hasResults(): boolean {
      return Boolean(
        this.simulationId &&
          this.calculs.resultats._id &&
          this.calculs.resultats._id === this.simulationId,
      )
    },
    situation() {
      return generateSituation(this.simulation, true)
    },
    getSimulationToken(): string | undefined {
      return this.simulation.simulationToken
    },
    // Le cookie d'accès est un cookie tiers quand le simulateur est intégré en
    // iframe : Safari le bloque sans exception. Le jeton porté par l'en-tête
    // reste, lui, disponible dans tous les contextes.
    authHeaders(): Record<string, string> | undefined {
      const token = this.getSimulationToken
      return token ? { Authorization: `Bearer ${token}` } : undefined
    },
    getFCUserInfoEmailValue() {
      const userinfo = this.simulation.answers.all.find(
        (answer) =>
          answer.entityName === "franceconnect" &&
          answer.fieldName === "userinfo",
      )
      return userinfo?.value["email"]
    },
    simulationAnonymized(): boolean {
      return this.simulation.status === SimulationStatus.Anonymized
    },
  },
  actions: {
    setDirty() {
      this.calculs.dirty = true
    },
    answer(answer: Answer) {
      const simulationAnswerValue = getAnswer(
        this.simulation.answers.all,
        answer.entityName,
        answer.fieldName,
        answer.id,
      )
      if (!isEqual(simulationAnswerValue, answer.value)) {
        this.setDirty()
        this.updateAnswerSimulation(answer)
      }
    },
    updateAnswerSimulation(answer: Answer) {
      this.simulation.answers = {
        ...this.simulation.answers,
        all: storeAnswer(this.simulation.answers.all, answer),
      }
    },
    updateCurrentAnswers(newPath: string) {
      const steps = this.getAllSteps
      const currentAnswers: Answer[] = []

      for (const step of steps) {
        if (step.path === newPath) {
          break
        }

        if (step.isActive && step.path !== "/") {
          const currentAnswer: Answer = this.simulation.answers.all.find(
            (answer: Answer) =>
              answer.id === step.id &&
              answer.entityName === step.entity &&
              answer.fieldName === step.variable,
          )
          if (currentAnswer) {
            currentAnswers.push(currentAnswer)
          }
        }
      }

      this.simulation.answers.current = currentAnswers
    },
    ressourcesFiscales(ressourcesFiscales: any) {
      this.simulation = {
        ...this.simulation,
        ressourcesFiscales,
      }
      this.setDirty()
    },
    setPatrimoine(patrimoine: Patrimoine | undefined) {
      this.simulation.patrimoine = patrimoine
      this.setDirty()
    },
    initialize() {
      Object.assign(this, restoreLocal(), { saveSituationError: null })
    },
    resetSimulation() {
      const state = defaultStore()

      const newStore = getPersitedStateProperties(state)
      Object.assign(this, newStore)
    },
    clear(external_id: string) {
      this.access.forbidden = false
      this.access.fetching = false

      this.resetSimulation()

      this.external_id = external_id
    },
    setDebug(debug: boolean) {
      this.debug = debug
    },

    addEnfant(): number {
      let enfantId
      let enfants
      if (this.simulation.enfants && this.simulation.enfants.length > 0) {
        enfantId =
          this.simulation.enfants[this.simulation.enfants.length - 1] + 1
        enfants = [...this.simulation.enfants, enfantId]
      } else {
        enfantId = 0
        enfants = [enfantId]
      }
      const answer = {
        entityName: "individu",
        id: `enfant_${enfantId}`,
        fieldName: "_firstName",
        value: `votre ${enfants.length}${
          enfants.length === 1 ? "ᵉʳ" : "ᵉ"
        } enfant`,
        path: `/simulation/individu/enfant_${enfantId}/_firstName`,
      }

      this.simulation = {
        ...this.simulation,
        enfants,
        answers: {
          ...this.simulation.answers,
          all: storeAnswer(this.simulation.answers.all, answer),
        },
      }
      this.setDirty()
      return enfantId
    },
    editEnfant(id: number) {
      // When you edit a children you need to remove all current answer after the child validation
      const currentLastIndex = this.simulation.answers.current.findIndex(
        (answer) => answer.entityName === "enfants",
      )

      const currentAnswers =
        currentLastIndex === -1
          ? this.simulation.answers.current
          : this.simulation.answers.current.splice(0, currentLastIndex)

      this.simulation.answers = {
        ...this.simulation.answers,
        current: currentAnswers.filter(
          (answer) => answer.id !== `enfant_${id}`,
        ),
      }

      this.setDirty()
    },
    removeEnfant(id: string) {
      const enfantIndex = parseInt(id.split("_")[1])
      this.simulation = {
        ...this.simulation,
        enfants: this.simulation.enfants?.filter((i) => i !== enfantIndex),
        answers: {
          all: this.simulation.answers.all.filter((answer) => answer.id !== id),
          current: this.simulation.answers.current.filter(
            (answer) => answer.id !== id,
          ),
        },
      }
      this.setDirty()
    },
    updateError(error?: string) {
      this.error = error
    },
    setFormRecapEmailState(newState: string | undefined) {
      this.recapEmailState = newState
    },
    setFormRecapPhoneState(newState: string | undefined) {
      this.recapPhoneState = newState
    },
    setFormRecapState(newState: string | undefined) {
      this.setFormRecapPhoneState(newState)
      this.setFormRecapEmailState(newState)
    },
    setModalState(newState: string | undefined) {
      this.modalState = newState
    },
    setSimulationId(id: string) {
      this.simulationId = id
      this.calculs.dirty = false
    },
    setSimulationToken(token: string): void {
      this.simulation.simulationToken = token
    },
    save() {
      this.setFormRecapState(undefined)

      const simulation = { ...this.simulation, _id: undefined }
      if (this.simulationId) {
        simulation.modifiedFrom = this.simulationId
      }

      //custom interest school
      if (useThemeStore().theme === "univ-paris-cite") {
        const flagAnswer: Answer = {
          entityName: "individu",
          id: "demandeur",
          fieldName: "_interetUnivParisCite",
          value: true,
        }
        simulation.answers = {
          ...simulation.answers,
          all: storeAnswer(simulation.answers.all, flagAnswer),
          current: storeAnswer(simulation.answers.current, flagAnswer),
        }
      }

      simulation.abtesting = ABTestingService.getValues()
      simulation.finishedAt = new Date()
      return axios
        .post("/api/simulation", simulation)
        .then((result) => result.data)
        .then((payload) => {
          this.setSimulationId(payload._id)
          this.setSimulationToken(payload.token)
        })
    },
    reset(simulation: Simulation) {
      this.access.fetching = false
      // Le serveur nomme le jeton `token`, le store `simulationToken` : sans
      // cette reprise, toute simulation rechargée repart sans jeton d'accès.
      this.simulation = {
        ...simulation,
        simulationToken:
          simulation.token ?? this.simulation.simulationToken ?? undefined,
      }
      this.dates = datesGenerator(simulation.dateDeValeur || new Date())
      this.calculs.dirty = false
    },
    saveAccessFailure() {
      this.access.fetching = false
      this.access.forbidden = true
    },
    fetch(id: string) {
      this.setFormRecapEmailState(undefined)
      this.setFormRecapPhoneState(undefined)
      this.setModalState(undefined)
      const token = this.getSimulationToken

      this.access.fetching = true
      const headers = {
        ...(token && { Authorization: `Bearer ${token}` }),
      }

      return axios
        .get(`/api/simulation/${id}`, { headers })
        .then((result) => result.data)
        .then((payload) => this.reset(payload))
        .then(() => this.setSimulationId(id))
        .catch((e) => {
          console.log(e)
          this.saveAccessFailure()
        })
    },
    setResults(results: Resultats) {
      this.calculs.resultats = results
      this.calculs.updating = false
    },
    async mockResults(benefit: any) {
      const { mockResults } = await import("@/lib/benefits.js")
      this.setResults(mockResults(benefit))
    },
    startComputation() {
      this.calculs.updating = true
      this.calculs.exception = false
      this.calculs.error = false
    },
    saveComputationFailure(error: any) {
      this.calculs.updating = false
      this.calculs.error = true
      this.calculs.exception = (error.response && error.response.data) || error
      Sentry.captureException(error)
    },
    computeResults() {
      this.startComputation()
      const token = this.getSimulationToken
      const headers = {
        ...(token && { Authorization: `Bearer ${token}` }),
      }
      return axios
        .get(`/api/simulation/${this.simulationId}/results`, {
          headers,
        })
        .then((response) => {
          return response.data
        })
        .then((results) => this.setResults(results as Resultats))
        .catch((error) => {
          this.saveComputationFailure(error)
        })
    },
    async retrieveResultsAlreadyComputed() {
      try {
        this.startComputation()
        const token = this.getSimulationToken
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined

        const { data } = await axios.get(
          `/api/simulation/${this.simulationId}/followup`,
          {
            headers,
          },
        )

        this.followup = data
        this.setResults({ droitsEligibles: this.followup.benefits })
      } catch (error) {
        Sentry.captureException(error)
        this.saveComputationFailure(error)
      }
    },
    setMessage(message: string, counter?: number) {
      this.message = {
        text: message,
        counter: counter || 1,
      }
    },
    decrementMessageRemainingViewTime() {
      if (!this.message.text) {
        return
      }

      this.message.counter = this.message.counter - 1
      if (this.message.counter < 0) {
        this.message.text = null
      }
    },
    redirection(next: (path: string) => void) {
      this.setMessage(
        `Vous avez été redirigé ou redirigée sur la première page du simulateur. Vous pensez que c'est une erreur&nbsp;? Contactez-nous&nbsp: <a href="mailto:${process.env.VITE_CONTACT_EMAIL}">${process.env.VITE_CONTACT_EMAIL}</a>.`,
      )
      next("/simulation")
    },
    setOpenFiscaParameters() {
      const date = new Date(this.simulation.dateDeValeur)
      return axios
        .get(`/api/openfisca/parameters/${date.toISOString()}`)
        .then((response) => {
          // Fusion, et non remplacement : un 200 au corps inattendu — page
          // d'erreur d'un intermédiaire, réponse tronquée — laisserait sinon un
          // paramètre indéfini, et les options qui s'en déduisent vaudraient
          // NaN. Le repli est un plancher, pas seulement un état initial.
          this.openFiscaParameters = { ...parametersList, ...response.data }
        })
        .catch(() => undefined) // Prevent unhandled promise rejection noise in Sentry on network hiccups.
    },
    verifyOpenfiscaBenefitVariables() {
      return axios
        .get("/api/openfisca/missingbenefits")
        .then((response) => response.data)
        .then((missingBenefits) => {
          if (Array.isArray(missingBenefits) && missingBenefits.length > 0) {
            this.setMessage(
              `🚀 Vous avez ajouté <abbr title="${missingBenefits.join(
                ", ",
              )}">une nouvelle aide</abbr>&nbsp;!<br/>Étant donné que nous ne savons pas encore comment celle-ci doit être calculée, si vous faites votre simulation jusqu’au bout vous obtiendrez un message d’erreur.`,
            )
          }
        })
    },
    setSaveSituationError(saveSituationError: string) {
      this.saveSituationError = saveSituationError
    },
    setTitle(newTitle: string) {
      this.title = newTitle
    },
  },
})
