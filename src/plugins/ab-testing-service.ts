import storageService from "@/lib/storage-service.js"
import type { ABTesting, ABTestingService } from "@lib/types/abtesting.d.js"

/*
 * L'AB testing repose sur les custom variables de Matomo
 * https://matomo.org/docs/custom-variables/
 *
 * NB :
 * *  Les variables d'AB testing sont enregistrées dans le localStorage pour toujours
 *       -> afficher la même version pour un usager donné
 * *  L'utilisation des 5 customs variables de Piwik permet de
 *       -> faire 5 tests différents en même temps
 * *  La suppression des variables en fin de test permet de
 *      -> ne pas polluer Matomo d'anciennes périodes de tests
 */
function getEnvironment() {
  const ABTestingEnvironment: ABTesting =
    storageService.local.getItem("ABTesting") || {}

  // index doit être dans [1, 5]
  // // Prépare la variable d'AB testing
  // ABTestingEnvironment.link = ABTestingEnvironment.link || { index: 1 };
  // // Réparti les visiteurs l'AB testing avec cette variable
  // ABTestingEnvironment.link.value = ABTestingEnvironment.link.value || (Math.random() > 0.5 ? 'A' : 'B');
  // // Après l'AB testing
  // // Pour le désactiver
  // // et libérer une custom variable
  // // ABTestingEnvironment.link.deleted = true;
  // cf. https://stats.beta.gouv.fr/index.php?module=CustomDimensions&action=manage&idSite=165

  // Exemple de test AB :
  // /1 Copier / Remplir / Décommenter ce bloc
  // /2 Ajouter une variante pour l'Intégration Continue si nécessaire : ABTestingService.setVariant("nom_du_test", "nom_de_la_version_A")
  //   - ici : https://github.com/DNUM-SocialGouv/aides-jeunes/blob/59e581d61fd285a68b3ccb637f29ab3c7f9972ac/src/router.ts#L280
  // /3 L'utiliser dans le code : ABTestingService.getValues().nom_du_test
  // Le bloc :
  // ABTestingEnvironment.name_of_the_test = ABTestingEnvironment.name_of_the_test || {}
  // ABTestingEnvironment.name_of_the_test.index = 2 (entre 1 et 5 inclus)
  // ABTestingEnvironment.name_of_the_test.value =
  //   ABTestingEnvironment.name_of_the_test.value ||
  //   (Math.random() > 0.5 ? "A version name" : "B version name")

  ABTestingEnvironment.aides_bafa = ABTestingEnvironment.aides_bafa || {}
  ABTestingEnvironment.aides_bafa.index = 4
  if (
    !ABTestingEnvironment.aides_bafa.value ||
    !ABTestingEnvironment.aides_bafa.value.endsWith("_conserve_position")
  ) {
    ABTestingEnvironment.aides_bafa.value =
      Math.random() > 0.5
        ? "aides_bafa_distinctes_conserve_position"
        : "aides_bafa_fusionnees_conserve_position"
  }

  ABTestingEnvironment.plans_to_ask_question =
    ABTestingEnvironment.plans_to_ask_question || {}
  ABTestingEnvironment.plans_to_ask_question.index = 3
  ABTestingEnvironment.plans_to_ask_question.value =
    ABTestingEnvironment.plans_to_ask_question.value ||
    (Math.random() > 0.5 ? "show" : "hidden")

  storageService.local.setItem("ABTesting", ABTestingEnvironment)
  return ABTestingEnvironment
}

function extractValueMap(env: ABTesting): { [key: string]: string } {
  const experimentKeys = Object.keys(env)
  return experimentKeys.reduce((result, key) => {
    const experiment = env[key]
    if (!experiment.deleted) {
      result[key] = experiment.value
    }
    return result
  }, {})
}

const ABTestingService: ABTestingService = {
  getValues() {
    return extractValueMap(getEnvironment())
  },
  setVariant(key, value) {
    const ABTestingEnvironment = getEnvironment()
    ABTestingEnvironment[key].value = value
    storageService.local.setItem("ABTesting", ABTestingEnvironment)

    return extractValueMap(ABTestingEnvironment)
  },
  getEnvironment,
}

export default ABTestingService
