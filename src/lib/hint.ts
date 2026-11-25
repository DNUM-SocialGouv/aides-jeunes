import { forEachProperties } from "@lib/mutualized-steps.js"

const texts = {
  depcom: (): string => {
    return `
    <p>
      Le simulateur n'accepte que les codes postaux français. Si vous vivez à l'étranger, ce simulateur n'est pas encore adapté à votre situation.
    </p>`
  },
  _bourseCriteresSociauxCommuneDomicileFamilial: (): string => {
    return `
    <p>
      Lorsque vos parents sont séparés, il faut indiquer le code postal du parent qui vous a à charge. 
      Si vous êtes encore mineur et en garde alternée, il faut indiquer le code postal du parent dont le domicile est le plus proche du votre.
    </p>`
  },
  enfants: (): string => {
    return `
    <p>
      « Un enfant à charge » est un enfant dont vous êtes responsable et dont vous vous occupez, qu'il soit votre enfant naturel ou non.
    </p>`
  },
  service_civique: (): string => {
    return `<p>
      Un Service Civique est un engagement volontaire au service de l'intérêt général. Depuis le 1er juillet 2022, le Service Civique est indemnisé 619,83 euros net par mois environ. 
      Pour plus d'informations, vous pouvez consulter <a href="https://www.service-civique.gouv.fr/comprendre-le-service-civique" target="_blank">le site officiel du Service Civique</a>.
    </p>
    <p>
      Vous pouvez trouver des missions sur <a href="https://www.1jeune1solution.gouv.fr/service-civique" target="_blank">la page dédié du site 1jeune1solution.gouv.fr</a>.
    </p>`
  },
  loyer: (): string => {
    return `
    <h3 class="fr-text--lg">Que sont les charges locatives ?</h3>
    <p>
      Les charges locatives (ou charges récupérables) sont des dépenses dues par le locataire, mais initialement payées par le propriétaire (ou son réprésentant). Le propriétaire (ou son représentant) 
      se fait rembourser ces dépenses par le locataire. Le mode de paiement de ces charges est différent, selon qu'il s'agit d'un bail d'habitation vide ou meublé.</br/><br/>
      Plus d'informations sur le site du service public : <a href="https://www.service-public.fr/particuliers/vosdroits/F947" target="_blank">https://www.service-public.fr/particuliers/vosdroits/F947</a>
    </p>
    <h3 class="fr-text--lg">Où trouver le montant des charges locatives ?</h3>
    <p>
      Les informations sur les charges locatives peuvent être trouvées dans plusieurs documents différents : sur votre bail de location, sur l'état des lieux ou sur le décompte annuel des charges.
    </p>`
  },
}

// Retrieve `moreInfo` field of each mutualized step
forEachProperties((_, propertyName, property) => {
  if (property.moreInfo) {
    texts[propertyName] = property.moreInfo
  }
})

const Hint = {
  get(attribute: string, variation?: string): string | undefined {
    // `attribute` comes from the URL: block inherited keys like "constructor".
    if (!Object.prototype.hasOwnProperty.call(texts, attribute)) {
      return undefined
    }
    return typeof texts[attribute] === "string"
      ? texts[attribute]
      : texts[attribute]?.(variation)
  },
}

export default Hint
