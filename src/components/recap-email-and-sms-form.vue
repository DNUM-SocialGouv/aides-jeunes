<script setup lang="ts">
import axios from "axios"
import WarningMessage from "@/components/warning-message.vue"
import { useStore } from "@/stores/index.js"
import { computed, ref } from "vue"
import { useRouter } from "vue-router"
import * as Sentry from "@sentry/vue"
import StatisticsMixin from "@/mixins/statistics.js"
import { EventCategory, EventAction } from "@lib/enums/event.js"

const router = useRouter()
const store = useStore()
const phoneValue = ref<string>()
const phoneRef = ref<HTMLFormElement>()
const emailValue = ref(store.getFCUserInfoEmailValue)
const emailRef = ref<HTMLFormElement>()
const emailInputErrorMessage = ref<boolean>()
const phoneInputErrorMessage = ref<boolean>()
const surveyOptin = ref<boolean>(false)

const recapPhoneState = computed(() => store.recapPhoneState)
const recapEmailState = computed(() => store.recapEmailState)
const emailFilled = computed(() => emailValue.value?.length ?? 0 > 0)
const phoneFilled = computed(() => phoneValue.value?.length ?? 0 > 0)
const emailAndPhoneFilled = computed(
  () => emailFilled.value && phoneFilled.value,
)

const simulationId = computed(
  () => !store.calculs.dirty && store.calculs.resultats?._id,
)

const inputPhonePattern = computed(() => {
  const diallingCodes: string | undefined =
    process.env.VITE_SMS_DIALLING_CODES?.toString().replaceAll(",", "|")
  return `^(((\\+?|00)(${diallingCodes})\\s?|0)[67])([\\s\\.\\-]?\\d{2}){4}`
})

const showSms = process.env.VITE_SHOW_SMS_TAB

const sendRecap = async () => {
  const optin = surveyOptin.value
  try {
    if (emailAndPhoneFilled.value) {
      await sendRecapByEmailAndSms(optin)
      store.setModalState(undefined)
    } else if (emailFilled.value && !phoneFilled.value) {
      await sendRecapByEmail(optin)
      phoneInputErrorMessage.value = false
      store.setFormRecapPhoneState(undefined)
      store.setModalState(undefined)
    } else if (!emailFilled.value && phoneFilled.value) {
      await sendRecapBySms(optin)
      emailInputErrorMessage.value = false
      store.setFormRecapEmailState(undefined)
      store.setModalState(undefined)
    } else {
      store.setFormRecapState(undefined)
      phoneInputErrorMessage.value = true
      emailInputErrorMessage.value = true
    }
  } catch (error: any) {
    const errorMessage = error?.response?.data?.toString() || ""
    if (!errorMessage.includes("Invalid destination address")) {
      Sentry.captureException(error)
    } else {
      store.setFormRecapPhoneState("invalid-address")
    }
  }
}

const inputPhoneIsValid = () => {
  if (phoneRef.value && !phoneRef.value?.checkValidity()) {
    phoneInputErrorMessage.value = true
    phoneRef.value.focus()
    StatisticsMixin.methods.sendEventToMatomo(
      EventCategory.General,
      EventAction.FormulaireTelephoneInvalide,
      router.currentRoute.value.fullPath,
    )
    return false
  }
  phoneInputErrorMessage.value = false
  return true
}

const inputEmailIsValid = () => {
  if (emailRef.value && !emailRef.value?.checkValidity()) {
    emailInputErrorMessage.value = true
    emailRef.value.focus()
    StatisticsMixin.methods.sendEventToMatomo(
      EventCategory.General,
      EventAction.FormulaireEmailInvalide,
      router.currentRoute.value.fullPath,
    )
    return false
  }
  emailInputErrorMessage.value = false
  return true
}

const formatPhoneNumber = (phone) => {
  return phone?.replace(/\s/g, "")
}

const postFollowup = async (surveyOptin, email?, phone?) => {
  const uri = `/api/simulation/${simulationId.value}/followup`
  const payload = {
    surveyOptin,
    phone: formatPhoneNumber(phone),
    email,
    contactRequired: true,
  }
  return await axios.post(uri, payload, { headers: store.authHeaders })
}

const sendRecapByEmailAndSms = async (surveyOptin) => {
  store.setFormRecapState("waiting")
  if (!inputEmailIsValid() || !inputPhoneIsValid()) {
    store.setFormRecapState(undefined)
    throw new Error("Invalid email or phone number")
  }
  try {
    store.setModalState(undefined)
    await postFollowup(surveyOptin, emailValue.value, phoneValue.value)
  } catch (error) {
    Sentry.captureException(error)
    store.setFormRecapState("error")
    throw error
  }
  store.setFormRecapState("ok")
  phoneValue.value = undefined
  emailValue.value = undefined
}

const sendRecapBySms = async (surveyOptin) => {
  store.setFormRecapPhoneState("waiting")
  store.setFormRecapEmailState(undefined)
  if (!inputPhoneIsValid()) {
    store.setFormRecapPhoneState(undefined)
    throw new Error("Invalid phone number")
  }
  try {
    store.setModalState(undefined)
    await postFollowup(surveyOptin, undefined, phoneValue.value)
  } catch (error) {
    Sentry.captureException(error)
    store.setFormRecapPhoneState("error")
    throw error
  }
  store.setFormRecapPhoneState("ok")
  phoneValue.value = undefined
}

const sendRecapByEmail = async (surveyOptin) => {
  store.setFormRecapEmailState("waiting")
  store.setFormRecapPhoneState(undefined)
  if (!inputEmailIsValid()) {
    store.setFormRecapEmailState(undefined)
    throw new Error("Invalid email")
  }
  try {
    store.setModalState(undefined)
    await postFollowup(surveyOptin, emailValue.value)
  } catch (error) {
    store.setFormRecapEmailState("error")
    throw error
  }
  store.setFormRecapEmailState("ok")
  emailValue.value = undefined
}
</script>

<template>
  <div class="fr-modal__content">
    <p class="fr-mb-2w">
      Recevoir mon récapitulatif par email ou SMS me permettra de retrouver
      facilement mes résultats plus tard.
    </p>
    <form class="fr-form fr-my-2w" @submit.prevent="sendRecap()">
      <div class="fr-form-group">
        <label class="fr-label" for="email"
          >Votre email
          <span class="fr-hint-text">Format attendu : nom@domaine.fr</span>
        </label>
        <input
          id="email"
          ref="emailRef"
          v-model="emailValue"
          name="email"
          required
          :aria-invalid="emailInputErrorMessage"
          :aria-describedBy="
            emailInputErrorMessage ? 'invalid-email-warning' : null
          "
          type="email"
          class="fr-input"
          autocomplete="email"
          :disabled="recapEmailState === 'waiting'"
        />
      </div>
      <WarningMessage
        v-if="emailInputErrorMessage"
        id="invalid-email-warning"
        class="fr-mt-2w"
        >Une adresse email valide doit être indiquée.
      </WarningMessage>
    </form>
    <form v-if="showSms" class="fr-form fr-my-2w" @submit.prevent="sendRecap()">
      <div class="fr-form-group">
        <label class="fr-label" for="phone"
          >Votre numéro de téléphone portable
          <span class="fr-hint-text"
            >Format attendu : 06 12 23 42 78 (numéros de France métropolitaine
            et DROM-COM)</span
          >
        </label>
        <input
          id="phone"
          ref="phoneRef"
          v-model="phoneValue"
          :pattern="inputPhonePattern"
          name="phone"
          required
          :aria-invalid="phoneInputErrorMessage"
          :aria-describedBy="
            phoneInputErrorMessage ? 'invalid-phone-warning' : null
          "
          type="tel"
          class="fr-input"
          autocomplete="tel"
          :disabled="recapPhoneState === 'waiting'"
        />
      </div>
      <WarningMessage
        v-if="phoneInputErrorMessage"
        id="invalid-phone-warning"
        class="fr-mt-2w"
      >
        Numéro de téléphone non pris en charge, vérifiez sa validité.
      </WarningMessage>
    </form>
  </div>
  <div class="fr-modal__footer">
    <div class="fr-grid-row fr-grid-row--center">
      <div class="fr-mb-2w">
        <div class="fr-checkbox-group">
          <input
            id="survey-optin"
            v-model="surveyOptin"
            type="checkbox"
            name="survey-optin"
          />
          <label class="fr-label fr-hint-text" for="survey-optin">
            J'accepte d'être recontacté dans une semaine pour dire si j’ai pu
            demander mes aides (optionnel)
          </label>
        </div>
      </div>
      <div class="fr-text--center">
        <button
          :disabled="recapPhoneState === 'waiting'"
          class="fr-btn"
          @click.prevent="sendRecap()"
        >
          Je souhaite recevoir mon récapitulatif
        </button>
      </div>
    </div>
  </div>
</template>
