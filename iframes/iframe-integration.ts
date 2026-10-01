import iframeResize from "@iframe-resizer/parent"

// Ce fichier est empaqueté par webpack sans loader TypeScript : il est parsé
// comme du JavaScript, donc écrit sans annotation de type.

// Marge de déclenchement, exprimée en hauteurs de fenêtre pour valoir autant
// sur mobile que sur grand écran. Elle doit couvrir le temps de démarrage du
// simulateur : `iframe-resizer` ajuste la hauteur du cadre une fois le contenu
// prêt, et ce réajustement doit avoir eu lieu AVANT que le visiteur arrive
// dessus. Sinon la page hôte se réorganise sous ses yeux.
const ROOT_MARGIN = "200%"

function buildSource(script) {
  const page = script.dataset.fromHome !== undefined ? "" : "simulation"
  const src = new URL(`${process.env.BASE_URL}/${page}`)

  src.searchParams.set("iframe", "true")
  src.searchParams.set("utm_source", `iframe@${window.location.hostname}`)
  src.searchParams.set("utm_term", window.location.pathname)
  src.searchParams.set(
    "data-with-logo",
    (script.dataset.withLogo !== undefined).toString(),
  )
  if (script.dataset.theme !== undefined) {
    src.searchParams.set("theme", script.dataset.theme)
  }

  return src.toString()
}

function buildIframe() {
  const iframe = document.createElement("iframe")
  const iframeAttributes = {
    id: "simulateur",
    title: process.env.IFRAME_TITLE,
    // Gabarit de départ. `iframe-resizer` le remplace par la hauteur réelle du
    // simulateur une fois celui-ci chargé ; c'est ce réajustement que la marge
    // de déclenchement doit rendre invisible.
    style: "border: none; width: 100%; display: block; height: 700px",
    allow: "clipboard-write",
    allowfullscreen: true,
    webkitallowfullscreen: true,
    mozallowfullscreen: true,
  }
  for (const key in iframeAttributes) {
    iframe.setAttribute(key, iframeAttributes[key])
  }
  return iframe
}

function insert(script, iframe) {
  if (script.parentElement && script.parentElement.tagName === "HEAD") {
    const body =
      script.parentElement.parentElement &&
      script.parentElement.parentElement.querySelector("body")
    if (body) {
      body.appendChild(iframe)
    }
    return
  }
  script.before(iframe)
}

function load(iframe, src) {
  if (iframe.src) {
    return
  }
  iframe.src = src
  iframeResize({ license: "GPLv3" }, iframe)
}

export function mountSimulator(script) {
  const iframe = buildIframe()
  const src = buildSource(script)
  insert(script, iframe)

  // Le simulateur est une application complète : la démarrer pour un visiteur
  // qui ne descendra jamais jusqu'à elle est du téléchargement perdu.
  // `data-eager` rétablit le chargement immédiat.
  //
  // L'absence d'`IntersectionObserver` y ramène également. Ce repli ne rend pas
  // le simulateur pleinement fonctionnel pour autant — `iframe-resizer` dépend
  // lui aussi de cette API, et le cadre restera au gabarit — mais il garantit
  // au moins que l'iframe reçoive une source, comme avant ce changement.
  const eager =
    script.dataset.eager !== undefined || !("IntersectionObserver" in window)

  if (eager) {
    load(iframe, src)
    return iframe
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect()
        load(iframe, src)
      }
    },
    { rootMargin: ROOT_MARGIN },
  )
  observer.observe(iframe)

  return iframe
}

if (document.currentScript) {
  mountSimulator(document.currentScript)
} else {
  // Sans `document.currentScript`, l'emplacement d'insertion est introuvable.
  // Le cas se produit avec `type="module"` ou une injection différée : mieux
  // vaut le dire que de ne rien afficher sans explication.
  console.error(
    "[aides-jeunes] simulateur non inséré : document.currentScript est absent. " +
      'Le script doit être inclus par une balise <script src>, sans type="module".',
  )
}
