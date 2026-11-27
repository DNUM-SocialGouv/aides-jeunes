<script setup lang="ts">
import { EventAction, EventCategory } from "@lib/enums/event"
import BackButton from "@/components/buttons/back-button.vue"

const props = defineProps({
  showBackButton: {
    type: Boolean,
    default: true,
  },
})

const contactEmail = process.env.VITE_CONTACT_EMAIL

const questionsAnswers = [
  {
    question: "Puis-je sauvegarder ma simulation ?",
    answer: `
    <p>
      À tout moment de la simulation, vous avez la possibilité de cliquer sur le bouton <b>"Revenir plus tard ?"</b>
      et la page associée vous permettra d'y récupérer un lien de sauvegarde.
    </p>
    <p>
      À la fin de la simulation, vous pouvez également sauvegarder vos résultats en demandant à les réceptionner
      par sms ou par email avec le bouton <b>"Recevoir les résultats par email/SMS"</b>.
    </p>`,
  },
  {
    question: "Je n'habite pas en France, puis-je faire une simulation ?",
    answer: `
    <p>
      Bien que le simulateur soit conçu pour les personnes résidant en France, si vous avez prévu de
      venir vivre en France dans le futur, vous pouvez tout de même réaliser une simulation en <b>vous projetant</b>
      avec le code postal où vous souhaitez habiter.
    </p>`,
  },
  {
    question: `Je suis étudiant étranger et mes parents ne résident pas en France, ai-je droit à des aides ?`,
    answer: `
    <p>
      Vous trouverez toute l'information sur les aides auxquelles vous avez droit en consultant cet article sur <a href="https://www.etudiant.gouv.fr/fr/aides-financieres-pour-les-etudiants-internationaux-1663" target="_blank">etudiant.gouv.fr</a>.
      Vous pouvez aussi trouver des informations utiles sur <a href="https://www.campusfrance.org/fr" target="_blank">Campus France</a>.
    </p>`,
  },
  {
    question: "Qu'est-ce que le service civique ?",
    answer: `
    <p>
    Un Service Civique est un engagement volontaire au service de l'intérêt général. Depuis le 1er juillet 2022, le Service Civique est indemnisé 619,83 euros net par mois environ.
    Pour plus d'informations, vous pouvez consulter le site officiel du <a href="https://www.service-civique.gouv.fr/comprendre-le-service-civique" target="_blank">Service Civique</a>.
    </p>
    <p>
    Vous pouvez trouver des missions sur <a href="https://www.1jeune1solution.gouv.fr/service-civique" target="_blank">la page dédié du site 1jeune1solution.gouv.fr</a>.
    </p>`,
  },
  {
    question: `Qu'est ce que le revenu fiscal de référence (RFR) et où le trouver ?`,
    answer: `
    <p>
      Le RFR est calculé par les services fiscaux (les impôts) à partir des revenus que vous avez déclarés
      ou que vos parents ont déclarés si vous êtes encore à leur charge.
      Il se trouve sur la première page de votre dernier avis d'impôt sur le revenu.
    </p>
    <p>
      Toutes les informations concernant le RFR et comment le trouver sont <a href="https://www.service-public.fr/particuliers/vosdroits/F13216" target="_blank">disponibles ici</a>.
    </p>`,
  },
  {
    question: "Qu'est ce que le revenu brut global (RBG) et où le trouver ?",
    answer: `
    <p>
      Le RBG est le montant total des revenus de votre foyer fiscal avant déductions et abattements. Pour les étudiants et futurs étudiants,
      les revenus pris en compte par le Crous pour calculer votre droit à la bourse sur critères sociaux (BCS)
      sont ceux qui figurent à la ligne « revenu brut global » sur la première page de l'avis d'imposition de vos parents.
    </p>`,
  },
  {
    question: "Je suis bloqué à la question sur le RFR / RBG, comment faire ?",
    answer: `
    <p>
      Si vous n'avez aucun moyen de déterminer le montant de votre RFR ou le RBG de vos parents lorsque vous êtes à leur charge),
      vous avez la possibilité de répondre 0 à ces questions. Attention, <b>certaines aides ne
      pourront pas être calculées correctement sans le montant exact</b> du RFR,
      comme par exemple l'aide de la
      <a href="/aides/bourse_criteres_sociaux" target="_blank">Bourse sur Critères Sociaux</a>
      pour les étudiants.
    </p>
    <p>Le revenu fiscal de référence (RFR) est calculé par les impôts, à partir
      des revenus que vous avez déclarés dans votre déclaration d'impôts. Il
      prend en compte l'ensemble des revenus de votre foyer fiscal, que vous
      soyez imposable ou non imposable. Toutes les informations concernant le
      RFR et comment le trouver sont <a href="https://www.service-public.fr/particuliers/vosdroits/F13216" target="_blank">disponibles ici</a>.
    </p>
    <p>
      Le revenu brut global est la somme de tous vos revenus déclarés après déduction des divers abattements,
      comme l'abattement de 10 % pour les salaires et les retraites, ou après déduction des frais réels si
      vous avez opté pour ce dispositif.
    </p>`,
  },
  {
    question:
      "Je suis en rupture familiale et n'ai pas accès à la déclaration d'impôts de mes parents, qui peut m'aider ?",
    answer: `
    <p>
      En fonction de votre situation, vous pouvez vous rapprocher :
      <ul>
        <li>des services sociaux du Crous si vous êtes étudiant ou étudiante</li>
        <li>des services sociaux de la Mairie de votre ville de résidence dans les autres situations</li>
      </ul>
    </p>`,
  },
  {
    question:
      "Je suis éligible à la CSS (Ex-CMU), comment en faire la demande ?",
    answer: `
    <p>
      Pour demander votre <a href="/aides/css_participation_forfaitaire" target="_blank">Complémentaire Santé Solidaire</a>, rendez-vous sur
      <a href="https://www.ameli.fr/">le site internet </a> ou l'application
      mobile Ameli pour télécharger le formulaire de demande. </br>
      Si vous avez un compte Ameli.fr, connectez-vous puis <a href="https://assure.ameli.fr/PortailAS/appmanager/PortailAS/assure?_somtc=true#idPopupWARecueilConsentement" target="_blank"> effectuez votre demande directement en ligne</a> depuis la rubrique <b>"Mes démarches > Faire une demande de complémentaire santé solidaire"</b>.
    </p>`,
  },
  {
    question: `Puis-je bénéficier d'aides si je pars étudier à l'étranger ?`,
    answer: `
    <p>
      Si vous envisagez de partir à l'étranger dans le cadre d'un échange universitaire, vous pouvez bénéficier de certaines aides présentées sur <a href="https://www.etudiant.gouv.fr/fr/bourses-erasmus-et-aide-la-mobilite-internationale-ami-67" target="_blank">le site etudiant.gouv.fr</a>.
    </p>
    <p>
      En revanche, si vous vous inscrivez directement auprès d'un établissement à l'étranger, vous ne pourrez pas bénéficier des mêmes aides. Vous devrez vous renseigner sur les aides de votre pays d'accueil pour les étudiants et vous rapprocher du consulat de France. Vous trouverez des informations pour préparer votre expatriation sur <a href="https://www.diplomatie.gouv.fr/fr/services-aux-francais/preparer-son-expatriation/etudes-superieures/" target="_blank">cette page du Ministère de l'Europe et des Affaires Etrangères</a>.
    </p>`,
  },
]

const mailContent = {
  subject: "Contact",
  body: `
        # Il est inutile de nous envoyer des documents personnels (carte de mutuelle, pièce d'identité, etc.) : nous ne pouvons pas les traiter.
        # Si vous souhaitez nous signaler une erreur, nous contacter à travers les liens proposés en fin de simulation facilite le traitement de votre demande.`,
}

const mailAnalytics = {
  action: EventAction.Contact,
  category: EventCategory.Contact,
}
</script>

<template>
  <div class="fr-my-6w fr-p-2w">
    <component :is="props.showBackButton ? 'h1' : 'h2'" class="fr-h1"
      >Foire aux questions</component
    >
    <BackButton
      v-show="props.showBackButton"
      size="small"
      data-testid="faq-back-button"
      class="fr-mb-3w"
    >
      Retour
    </BackButton>
    <div class="fr-p-1w">
      <section
        v-for="(qa, index) in questionsAnswers"
        :key="qa.question"
        class="fr-accordion"
      >
        <button
          class="fr-accordion__btn"
          aria-expanded="false"
          :aria-controls="`accordion-${index}`"
          >{{ qa.question }}</button
        >
        <div
          :id="`accordion-${index}`"
          class="fr-collapse"
          v-html="qa.answer"
        />
      </section>
      <h2 class="fr-text--lead fr-mt-6w">
        Vous ne trouvez pas de réponse à votre question ?
      </h2>
      <p>
        Nous contacter par email :
        <a v-mail="mailContent" :v-analytics="mailAnalytics" type="mailto">{{
          contactEmail
        }}</a>
      </p>
    </div>
  </div>
</template>
