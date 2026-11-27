/// <reference types="Cypress" />
import "cypress-axe"
import "../utils/accessibility.js"
import navigate from "../utils/navigate.js"
import profil from "../utils/profil.js"
import foyer from "../utils/foyer.js"
import logement from "../utils/logement.js"
import revenu from "../utils/revenu.js"
import projet from "../utils/projet.js"
import results from "../utils/results.js"
import { submit } from "../utils/form.js"

const EMOJI = /\p{Extended_Pictographic}/u

const visibleText = (el) => {
  const clone = el.cloneNode(true)
  clone.querySelectorAll("[aria-hidden=true]").forEach((n) => n.remove())
  return clone.textContent.trim()
}

// Checks every RGAA criterion that can be asserted on a rendered page.
const checkRgaaPage = () => {
  cy.get("main#main h1").should("be.visible")
  cy.checkA11y()

  cy.document().then((doc) => {
    // 8.3 / 8.4 default language
    expect(doc.documentElement.lang, "8.3 lang").to.equal("fr")

    // 8.5 / 8.6 page title
    expect(doc.title.trim(), "8.5 title").not.to.equal("")

    // 9.1 exactly one h1 and no skipped heading level
    const headings = [
      ...doc.querySelectorAll(
        "main h1, main h2, main h3, main h4, main h5, main h6",
      ),
    ].filter((h) => h.checkVisibility({ visibilityProperty: true }))
    expect(
      headings.filter((h) => h.tagName === "H1"),
      "9.1 single h1",
    ).to.have.length(1)
    headings.reduce((previous, h) => {
      const level = Number(h.tagName[1])
      expect(
        level,
        `9.1 heading level after h${previous}: "${h.textContent.trim()}"`,
      ).to.be.at.most(previous + 1)
      return level
    }, 1)

    // 13.5 emojis in headings are hidden from assistive technologies
    headings.forEach((h) =>
      expect(
        visibleText(h),
        `13.5 emoji in "${h.textContent.trim()}"`,
      ).not.to.match(EMOJI),
    )

    // 12.6 landmarks
    expect(
      doc.querySelectorAll("header[role=banner], [role=banner]").length,
      "12.6 header",
    ).to.be.at.least(1)
    expect(doc.querySelectorAll("main").length, "12.6 single main").to.equal(1)
    expect(
      doc.querySelectorAll("footer, [role=contentinfo]").length,
      "12.6 footer",
    ).to.be.at.least(1)

    // 12.7 skip links point to existing targets
    const skiplinks = [...doc.querySelectorAll(".fr-skiplinks a[href*='#']")]
    expect(skiplinks.length, "12.7 skip links").to.be.greaterThan(0)
    skiplinks.forEach((a) => {
      const id = a.getAttribute("href").split("#")[1]
      expect(doc.getElementById(id), `12.7 target #${id}`).not.to.equal(null)
    })
  })

  // 10.11 no horizontal scroll at 320px
  cy.viewport(320, 640)
  cy.window().should((win) => {
    expect(
      win.document.documentElement.scrollWidth,
      "10.11 horizontal scroll at 320px",
    ).to.be.at.most(win.innerWidth)
  })
  cy.viewport(1280, 900)
}

const checkTitleContains = (text) => cy.title().should("contain", text)

const STATIC_PAGES = [
  "/",
  "/aides",
  "/aides/caf-aide-nationale-bafa",
  "/ville/paris",
  "/faq",
  "/simulez-aides-mobilite-internationale-preparez-depart-sereinement",
  "/preparer-rentree-etudiante-logement-budget-aides",
  "/accessibilite",
  "/contact",
  "/cgu",
]

describe("RGAA", () => {
  beforeEach(() => {
    cy.viewport(1280, 900)
    navigate.init()
    cy.injectAxe()
  })

  STATIC_PAGES.forEach((path) => {
    it(`static page ${path}`, () => {
      cy.visit(`http://localhost:8080${path}`)
      cy.injectAxe()
      checkRgaaPage()
    })
  })

  it("each static page has its own title (8.6)", () => {
    const titles = []
    STATIC_PAGES.forEach((path) => {
      cy.visit(`http://localhost:8080${path}`)
      cy.get("main#main h1").should("be.visible")
      cy.title().then((title) => titles.push(title))
    })
    cy.wrap(titles).should((list) => {
      const duplicates = list.filter((t, i) => list.indexOf(t) !== i)
      expect(duplicates, "8.6 duplicated titles").to.have.length(0)
    })
  })

  it("benefit detail page title names the benefit (8.6)", () => {
    cy.visit("http://localhost:8080/aides/caf-aide-nationale-bafa")
    checkTitleContains("BAFA")
  })

  it("simulation journey", () => {
    navigate.goHome()

    checkRgaaPage()
    checkTitleContains("Mon profil")

    // 11.10 required field error is announced to screen readers
    submit()
    cy.get("[role=alert]").should("contain", "Ce champ est obligatoire")

    profil.publicStudent()
    checkRgaaPage()
    checkTitleContains("Mon foyer")

    foyer.children(0)
    foyer.fill_en_couple(false)
    foyer.fill__situation("separes")
    foyer.fill_bourse_criteres_sociaux_nombre_enfants_a_charge(1)
    foyer.fill_bourse_criteres_sociaux_nombre_enfants_a_charge_dans_enseignement_superieur(
      1,
    )
    checkRgaaPage()
    checkTitleContains("Mon logement")

    logement.fill__logementType("locataire")
    logement.fill__locationType("vide")
    logement.fill_coloc(false)
    logement.fill_logement_chambre(false)
    logement.fill_proprietaire_proche_famille(false)
    logement.fill_loyer(600, 100)
    logement.fill_depcom("75001")
    logement.fill__difficultes_acces_ou_frais_logement(false)
    logement.fill_parisien(true)
    logement.fill__en_france(true)
    logement.fill_depcom(
      "75001",
      "_bourseCriteresSociauxCommuneDomicileFamilial",
    )
    logement.fill__nombreMoisEntreeLogement(-2)
    checkRgaaPage()
    checkTitleContains("Mes revenus")

    revenu.fill_ressources_types(["salaire_net"])
    revenu.fillConstantRevenu(1101.42)
    revenu.fillRevenuBrut(1)
    projet.fill__interetsAidesVelo([])
    projet.fill__interetBafa(true)
    projet.fill__interetPermisDeConduire(false)
    projet.fill__interetEtudesEtranger(true)
    projet.fill__dureeMoisEtudesEtranger(2)
    results.wait()
    checkRgaaPage()

    cy.get("[data-testid=caf-aide-nationale-bafa]").first().click()
    checkRgaaPage()
    cy.get("h1").should("contain", "Mes résultats")
    checkTitleContains("BAFA")

    navigate.goRecap()
    checkRgaaPage()
  })
})
