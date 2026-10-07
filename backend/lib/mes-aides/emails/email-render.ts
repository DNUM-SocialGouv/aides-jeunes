import fs from "fs"
import { load } from "js-yaml"
import path from "path"
import consolidate from "consolidate"
import { fileURLToPath } from "url"

const mustache = consolidate.mustache
import config from "../../../config/index.js"
import openfiscaController from "../../openfisca/parameters.js"
import { formatBenefits, basicBenefitText } from "./simulation-results.js"
import { mjml } from "./index.js"
import { EmailType } from "../../../../lib/enums/messaging.js"
import { SurveyType } from "../../../../lib/enums/survey.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function readFile(filePath) {
  return fs.readFileSync(path.resolve(__dirname, filePath), "utf8")
}

const emailTemplate = readFile("templates/email.mjml")
const footerTemplate = readFile("templates/footer.mjml")
const headerTemplate = readFile(`templates/${config.contextName}/header.mjml`)
const style = load(readFile(`templates/${config.contextName}/style.yaml`))
const simulationResultsTemplate = readFile("templates/simulation-results.mjml")
const simulationUsefulnessTemplate = readFile(
  "templates/simulation-usefulness.mjml",
)
const emailTemplates = {
  [EmailType.SimulationResults]: simulationResultsTemplate,
  [EmailType.SimulationUsefulness]: simulationUsefulnessTemplate,
}
const simulationResultsTextTemplate = readFile(
  "templates/simulation-results.txt",
)
const simulationUsefulnessTextTemplate = readFile(
  "templates/simulation-usefulness.txt",
)
const textTemplates = {
  [EmailType.SimulationResults]: simulationResultsTextTemplate,
  [EmailType.SimulationUsefulness]: simulationUsefulnessTextTemplate,
}

const dataTemplateBuilder = (
  emailType: EmailType,
  followup,
  formatedBenefits,
  benefitTexts,
) => {
  return {
    benefitTexts,
    baseURL: config.baseURL,
    contactEmail: config.contactEmail,
    contextName: config.contextName,
    ctaLink: `${config.baseURL}${followup.surveyPathTracker}`,
    droits: formatedBenefits,
    emailRenderURL: `${config.baseURL}${followup.emailRenderPath}${emailType}`,
    returnURL: `${config.baseURL}${followup.returnPath}`,
    wasUsefulLinkYes: `${config.baseURL}${followup.wasUsefulPath}`,
    wasUsefulLinkNo: `${config.baseURL}${followup.wasNotUsefulPath}`,
    style,
    partials: {
      header: headerTemplate,
      content: emailTemplates[emailType],
      footer: footerTemplate,
    },
  }
}

function renderAsText(emailType: EmailType, dataTemplate) {
  return mustache.render(textTemplates[emailType], dataTemplate)
}

function renderAsHtml(emailType: EmailType, dataTemplate) {
  if (!(emailType in emailTemplates)) {
    throw new Error(`Unknown email type: ${emailType}`)
  }
  return mustache
    .render(emailTemplate, dataTemplate)
    .then(async function (templateString) {
      const output = await mjml(templateString)
      return {
        html: output.html,
      }
    })
}

export async function emailRender(emailType: EmailType, followup) {
  let benefits: any = null
  let parameters: any = null
  let formatedBenefits: any = {}
  let benefitTexts: any = {}

  if (emailType === EmailType.SimulationResults) {
    const populated = await (followup.populated("simulation")
      ? Promise.resolve(followup)
      : followup.populate("simulation"))

    parameters = await openfiscaController.getParametersAsync(
      populated.simulation.dateDeValeur,
    )

    const situationResults = await populated.simulation.compute()
    benefits = situationResults.droitsEligibles

    formatedBenefits = formatBenefits(benefits, parameters)
    benefitTexts = benefits.map((benefit) =>
      basicBenefitText(benefit, parameters),
    )
  }

  const dataTemplate = dataTemplateBuilder(
    emailType,
    followup,
    formatedBenefits,
    benefitTexts,
  )

  return Promise.all([
    renderAsText(emailType, dataTemplate),
    renderAsHtml(emailType, dataTemplate),
  ]).then((values) => {
    if (emailType === EmailType.SimulationResults) {
      return {
        subject: `Récapitulatif de votre simulation sur ${config.contextName} [${followup.simulation._id}]`,
        text: values[0],
        html: values[1].html,
        attachments: values[1].attachments,
      }
    } else if (emailType === EmailType.SimulationUsefulness) {
      return {
        subject: `Votre simulation sur ${
          config.contextName
        } vous a-t-elle été utile ? [${
          followup.simulation?._id || followup.simulation
        }]`,
        text: values[0],
        html: values[1].html,
      }
    }
  })
}

export async function emailRenderBySurveyType(
  surveyType: SurveyType,
  followup,
) {
  switch (surveyType) {
    case SurveyType.TrackClickOnSimulationUsefulnessEmail:
      return emailRender(EmailType.SimulationUsefulness, followup)
    case SurveyType.BenefitAction:
      return Promise.reject(
        new Error(
          `This surveyType "${surveyType}" is not supposed to be sent through an email`,
        ),
      )
    default:
      return Promise.reject(
        new Error(`This surveyType "${surveyType}" has no email template`),
      )
  }
}
