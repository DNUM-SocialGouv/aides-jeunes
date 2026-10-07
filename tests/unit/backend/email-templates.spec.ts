import { expect } from "vitest"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { load } from "js-yaml"
import consolidate from "consolidate"
import config from "@root/backend/config/index.js"
import { mjml } from "@backend/lib/mes-aides/emails/index.js"

const mustache = consolidate.mustache

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const templatesDir = path.resolve(
  __dirname,
  "../../../backend/lib/mes-aides/emails/templates",
)
const readTemplate = (p: string) =>
  fs.readFileSync(path.join(templatesDir, p), "utf8")

const emailTemplate = readTemplate("email.mjml")
const footerTemplate = readTemplate("footer.mjml")
const headerTemplate = readTemplate(`${config.contextName}/header.mjml`)
const style = load(readTemplate(`${config.contextName}/style.yaml`))

// Un droit factice couvrant tous les champs utilisés par les partials mustache
const fakeDroit = {
  institution: { label: "CAF" },
  imgSrc: "/img/fake.png",
  benefitLabel: "Aide factice",
  montant: "100 €",
  description: "Description de l'aide.",
  ctaLabel: "Faire une demande",
}

const baseData = {
  benefitTexts: [],
  baseURL: "http://localhost:8080",
  contactEmail: "contact@example.fr",
  contextName: config.contextName,
  ctaLink: "http://localhost:8080/cta",
  droits: [fakeDroit, fakeDroit],
  emailRenderURL: "http://localhost:8080/render",
  returnURL: "http://localhost:8080/return",
  wasUsefulLinkYes: "http://localhost:8080/yes",
  wasUsefulLinkNo: "http://localhost:8080/no",
  style,
}

const contentTemplates = {
  "simulation-results": readTemplate("simulation-results.mjml"),
  "simulation-usefulness": readTemplate("simulation-usefulness.mjml"),
}

describe("Rendu des emails MJML", () => {
  for (const [name, content] of Object.entries(contentTemplates)) {
    it(`compile "${name}" sans erreur MJML et produit du HTML`, async () => {
      const templateString = await mustache.render(emailTemplate, {
        ...baseData,
        partials: {
          header: headerTemplate,
          content,
          footer: footerTemplate,
        },
      })

      const output = await mjml(templateString)

      expect(output.errors).toEqual([])
      expect(output.html).toBeTruthy()
      expect(output.html.length).toBeGreaterThan(0)
    })
  }
})
