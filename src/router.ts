import { nextTick } from "vue"
import { createWebHistory, createRouter } from "vue-router"
import context from "./context/index.js"
import Simulations from "@/lib/simulation.js"
import { getTitleFromRoute } from "@/lib/transition.js"
import { useStore } from "@/stores/index.js"
import { getBenefit } from "@/lib/benefits.js"
import { capitalize } from "@lib/utils.js"
import ABTestingService from "@/plugins/ab-testing-service.js"

function withBenefitLabel(params, title: string) {
  const label = getBenefit(params.benefitId)?.label
  return label ? `${capitalize(label)} – ${title}` : title
}

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes: [
    ...context.routes,
    {
      path: "/",
      name: "home",
      component: context.Home,
    },
    {
      path: "/contribuer",
      name: "contribuer",
      component: () => import("./views/contribuer/add-benefit.vue"),
      meta: {
        headTitle: `Proposer une nouvelle aide sur ${context.name}`,
      },
    },
    {
      path: "/contribuer/institution",
      name: "contribuer-institution",
      component: () => import("./views/contribuer/institution.vue"),
      meta: {
        headTitle: `Ajouter une institution sur ${context.name}`,
      },
    },
    {
      path: "/callback",
      name: "callback",
      component: () => import("./views/france-connect-callback.vue"),
    },
    {
      path: "/logout-callback",
      name: "logout-callback",
      redirect: (to) => `/api/france-connect${to.fullPath}`,
    },
    {
      path: "/simulation",
      name: "simulation",
      redirect: "/simulation/individu/demandeur/date_naissance",
      component: context.Simulation,
      meta: {
        headTitle: `Ma simulation sur le simulateur d'aides ${context.name}`,
      },
      children: [
        {
          path: "revenir-plus-tard",
          name: "revenirPlusTard",
          component: () => import("./views/simulation/revenir-plus-tard.vue"),
        },
        {
          path: "redirect",
          name: "redirect",
          beforeEnter(to, from, next) {
            const simulationLatestId = Simulations.getLatestId()
            if (simulationLatestId) {
              const store = useStore()
              store
                .fetch(simulationLatestId)
                .then(() => {
                  next(`/simulation${to.query.to || ""}`)
                })
                .catch(() => {
                  next("/")
                })
            } else {
              next("/")
            }
          },
        },
        {
          path: ":parent+/en_savoir_plus",
          name: "en_savoir_plus",
          component: () => import("./components/en-savoir-plus-content.vue"),
        },
        {
          name: "individu",
          path: "individu/:id",
          redirect: "/simulation/individu/:id/date_naissance",
          component: () => import("./views/simulation/individu.vue"),
          children: [
            {
              name: "ressources/types",
              path: "ressources/types",
              component: () =>
                import("./views/simulation/Ressources/types.vue"),
            },
            {
              name: "_hasRessources",
              path: "_hasRessources",
              component: () =>
                import("./views/simulation/Ressources/enfants.vue"),
            },
            {
              name: "ressources/montants",
              path: "ressources/montants/:category",
              component: () =>
                import("./views/simulation/Ressources/montants.vue"),
            },
            {
              name: "_bourseCriteresSociauxCommuneDomicileFamilial",
              path: "_bourseCriteresSociauxCommuneDomicileFamilial",
              component: () => import("./views/simulation/depcom-step.vue"),
            },
            {
              name: "IndividuStep",
              path: ":fieldName",
              component: () => import("./views/simulation/mutualized-step.vue"),
            },
          ],
        },
        {
          path: "parents/:fieldName",
          component: () => import("./views/simulation/mutualized-step.vue"),
        },
        {
          path: "enfants",
          component: () => import("./views/simulation/enfants.vue"),
        },
        {
          path: "famille",
          component: () => import("./views/simulation/famille.vue"),
          children: [
            {
              name: "FamilleStep",
              path: ":fieldName",
              component: () => import("./views/simulation/mutualized-step.vue"),
            },
          ],
        },
        {
          path: "menage",
          component: () => import("./views/simulation/menage.vue"),
          children: [
            {
              name: "loyer",
              path: "loyer",
              component: () => import("./views/simulation/Menage/loyer.vue"),
            },
            {
              name: "depcom",
              path: "depcom",
              component: () => import("./views/simulation/depcom-step.vue"),
            },
            {
              name: "MenageStep",
              path: ":fieldName",
              component: () => import("./views/simulation/mutualized-step.vue"),
            },
          ],
        },
        {
          name: "recapitulatif",
          path: "recapitulatif",
          meta: {
            headTitle: `Récapitulatif de vos réponses sur le simulateur d'aides ${context.name}`,
          },
          component: () => import("./views/simulation/recapitulatif.vue"),
        },
        {
          name: "resultatsWrapper",
          path: "resultats",
          meta: {
            headTitle: `Les résultats de ma simulation sur le simulateur d'aides ${context.name}`,
          },
          component: () =>
            import("./views/simulation/resultats/resultats-wrapper.vue"),
          children: [
            {
              name: "resultats",
              path: "",
              component: () =>
                import("./views/simulation/resultats/resultats.vue"),
            },
            {
              name: "resultatsDetails",
              path: ":benefitId",
              component: () =>
                import("./views/simulation/resultats/resultats-details.vue"),
              meta: {
                showBackToResultsButton: true,
                headTitle: (params) =>
                  withBenefitLabel(
                    params,
                    `Les résultats de ma simulation sur le simulateur d'aides ${context.name}`,
                  ),
              },
            },
            {
              name: "resultatsGroupe",
              path: "groupe/:groupId",
              component: () =>
                import("./views/simulation/resultats/benefits-list.vue"),
              meta: { showBackToResultsButton: true },
            },
            {
              name: "resultatsLieuxGeneriques",
              path: "lieux",
              component: () =>
                import("./views/simulation/resultats/lieux-generiques.vue"),
              meta: { showBackToResultsButton: true },
            },
            {
              name: "resultatInattendu",
              path: "inattendu/:id",
              component: () =>
                import("./views/simulation/resultats/resultat-inattendu.vue"),
              meta: {
                title: "Résultat inattendu",
                showBackToResultsButton: true,
              },
            },
            {
              name: "benefitLieuInformations",
              path: ":benefitId/:lieu_id/informations",
              component: () =>
                import("./views/simulation/resultats/lieu-informations.vue"),
            },
          ],
        },
        {
          name: "ressourcesFiscales",
          path: "ressources/fiscales",
          component: () => import("./views/simulation/Ressources/fiscales.vue"),
          meta: {
            title() {
              const store = useStore()
              return `Les revenus imposables de votre foyer en ${store.dates.fiscalYear.label}`
            },
          },
        },
        {
          name: "ressourcesPatrimoine",
          path: "ressources/patrimoine",
          component: () =>
            import("./views/simulation/Ressources/patrimoine.vue"),
          meta: {
            title: "Votre patrimoine",
          },
        },
      ],
    },
    {
      path: "/redirection",
      name: "redirection",
      component: () => import("./views/redirection.vue"),
    },
    {
      path: "/aides",
      name: "liste-aides",
      component: () => import("./views/liste-aides.vue"),
      meta: {
        headTitle: `Toutes les aides du simulateur ${context.name}`,
      },
    },
    {
      path: "/contribuer/aides",
      name: "contribuer-liste-aides",
      component: () => import("./views/contribuer/benefits-list.vue"),
      meta: {
        headTitle: `Toutes les aides du simulateur ${context.name}`,
      },
    },
    {
      path: "/preview",
      name: "preview",
      component: () => import("./views/preview.vue"),
    },
    {
      path: "/aides/:benefitId",
      name: "aide",
      component: () => import("./views/aide.vue"),
      meta: {
        headTitle: (params) =>
          withBenefitLabel(params, `Simulateur d'aides ${context.name}`),
      },
    },
    {
      path: "/parcours",
      name: "parcours",
      component: () => import("./views/parcours.vue"),
    },
    {
      path: "/preremplissage",
      name: "preremplissage",
      component: () => import("./views/preremplissage.vue"),
    },
    {
      path: "/suivi",
      name: "suivi",
      component: () => import("./views/suivi.vue"),
    },
    {
      path: "/accompagnement",
      name: "liste-accompagnements",
      component: () => import("./views/accompagnement/accompagnement.vue"),
    },
    {
      path: "/accompagnement/:followupId",
      name: "accompagnement",
      component: () => import("./views/accompagnement/accompagnement.vue"),
    },
    {
      path: "/faq",
      name: "faq",
      component: () => import("./views/faq.vue"),
      meta: {
        headTitle: `Foire aux questions du simulateur ${context.name}`,
      },
    },
    {
      path: "/simulez-aides-mobilite-internationale-preparez-depart-sereinement",
      name: "simulez-aides-mobilite-internationale-preparez-depart-sereinement",
      component: () =>
        import(
          "./views/simulez-aides-mobilite-internationale-preparez-depart-sereinement.vue"
        ),
      meta: {
        headTitle: `Simulez vos aides à la mobilité internationale : préparez votre départ sereinement`,
      },
    },
    {
      path: "/preparer-rentree-etudiante-logement-budget-aides",
      name: "preparer-rentree-etudiante-logement-budget-aides",
      component: () =>
        import("./views/preparer-rentree-etudiante-logement-budget-aides.vue"),
      meta: {
        headTitle: `Préparer sa rentrée étudiante 2025 : logement, budget, aides`,
      },
    },
    {
      path: "/ville/lyon",
      name: "ville-lyon",
      component: () => import("./views/villes/lyon.vue"),
      meta: {
        headTitle: `Aides disponibles sur la ville de Lyon`,
      },
    },
    {
      path: "/ville/paris",
      name: "ville-paris",
      component: () => import("./views/villes/paris.vue"),
      meta: {
        headTitle: `Aides disponibles sur la ville de Paris`,
      },
    },
    {
      path: "/ville/marseille",
      name: "ville-marseille",
      component: () => import("./views/villes/marseille.vue"),
      meta: {
        headTitle: `Aides disponibles sur la ville de Marseille`,
      },
    },
    {
      path: "/ville/lille",
      name: "ville-lille",
      component: () => import("./views/villes/lille.vue"),
      meta: {
        headTitle: `Aides disponibles sur la ville de Lille`,
      },
    },
    {
      path: "/ville/bordeaux",
      name: "ville-bordeaux",
      component: () => import("./views/villes/bordeaux.vue"),
      meta: {
        headTitle: `Aides disponibles sur la ville de Bordeaux`,
      },
    },
    {
      path: "/ville/toulouse",
      name: "ville-toulouse",
      component: () => import("./views/villes/toulouse.vue"),
      meta: {
        headTitle: `Aides disponibles sur la ville de Toulouse`,
      },
    },
    {
      path: "/ville/nantes",
      name: "ville-nantes",
      component: () => import("./views/villes/nantes.vue"),
      meta: {
        headTitle: `Aides disponibles sur la ville de Nantes`,
      },
    },
    {
      path: "/ville/nice",
      name: "ville-nice",
      component: () => import("./views/villes/nice.vue"),
      meta: {
        headTitle: `Aides disponibles sur la ville de Nice`,
      },
    },
    {
      path: "/ville/strasbourg",
      name: "ville-strasbourg",
      component: () => import("./views/villes/strasbourg.vue"),
      meta: {
        headTitle: `Aides disponibles sur la ville de Strasbourg`,
      },
    },
    {
      path: "/ville/montpellier",
      name: "ville-montpellier",
      component: () => import("./views/villes/montpellier.vue"),
      meta: {
        headTitle: `Aides disponibles sur la ville de Montpellier`,
      },
    },
    {
      path: "/ville/rouen",
      name: "ville-rouen",
      component: () => import("./views/villes/rouen.vue"),
      meta: {
        headTitle: `Aides disponibles sur la ville de Rouen`,
      },
    },
    {
      path: "/init-ci",
      name: "init-ci",
      redirect: () => {
        ABTestingService.setVariant(
          "aides_bafa",
          "aides_bafa_fusionnees_conserve_position",
        )
        return "/"
      },
    },
    {
      path: "/:catchAll(.*)",
      name: "page-introuvable",
      redirect: () => {
        return "/"
      },
    },
  ],
  // https://router.vuejs.org/guide/advanced/scroll-behavior.html
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else if (to.hash) {
      return {
        el: to.hash,
        behavior: "smooth",
      }
    }
  },
})

router.beforeEach((to, from, next) => {
  const store = useStore()
  if (!from.name) {
    if (
      process.env.VITE_CONTEXT !== "production" ||
      to?.redirectedFrom?.fullPath === "/init-ci"
    ) {
      store.verifyOpenfiscaBenefitVariables()
    }

    if (
      to.matched.some((r) => r.name === "foyer" || r.name === "simulation") &&
      !to.path.endsWith("/date_naissance") &&
      typeof to.name === "string" &&
      !(
        to.name == "redirect" ||
        to.name == "recapitulatif" ||
        to.matched.some((r) => r.name === "resultatsWrapper")
      ) &&
      !store.passSanityCheck &&
      to.query.debug === undefined
    ) {
      return store.redirection((route) => next(route))
    }
  }
  const metaTitle = to.meta.title
  if (metaTitle) {
    if (typeof metaTitle === "function") {
      store.setTitle(metaTitle(to, store.situation))
    } else if (typeof metaTitle === "string") {
      store.setTitle(metaTitle)
    }
  } else {
    store.setTitle("Évaluez vos droits aux aides sociales")
  }

  if (store.error) {
    store.updateError()
  }
  if (store.message.text) {
    store.decrementMessageRemainingViewTime()
  }

  // When a child has been removed from the /enfants step, the previous child questions should be skipped
  const { current } = window.history.state || {}
  const enfantPath = "/individu/enfant_"

  if (current && current.includes(enfantPath)) {
    const id_enfant = current.split(enfantPath)[1].split("/")[0]
    const hasStoreChild = store.situation.enfants?.some(
      (enfant) => enfant.id === `enfant_${id_enfant}`,
    )

    if (!hasStoreChild) {
      // go(-2) used to skip the "/enfants" step on the removed child first step "_firstName"
      const stepsToGoBack = current.includes("_firstName") ? -2 : -1
      return router.go(stepsToGoBack)
    }
  }

  next()
})

router.afterEach((to, from) => {
  nextTick(function () {
    // scroll with a hash is managed in scrollBehavior
    if (!to.hash && from.name !== undefined) {
      const header = document.querySelector("h1")
      header?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      })
    }

    document.title = getTitleFromRoute(to)
  })
})

export default router
