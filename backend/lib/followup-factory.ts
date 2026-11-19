import Followups from "../models/followup.js"
import { Followup } from "@lib/types/followup.js"
import { Simulation } from "@lib/types/simulation.js"
import utils from "../lib/utils.js"

const DefaultVersion = 6
const TokenLength = 17

export const FollowupFactory = {
  create: async (
    simulation: Simulation,
    props?: {
      surveyOptin: boolean
      email?: string
      phone?: string
      benefits: any[]
    },
  ): Promise<Followup> => {
    const accessToken = await utils.generateToken(TokenLength)
    const followup = await Followups.create({
      simulation,
      accessToken,
      version: DefaultVersion,
      ...props,
    })

    simulation.hasFollowup = true
    await simulation.save()

    return followup
  },
  createWithResults: async (
    simulation: Simulation,
    surveyOptin: boolean,
    email?: string,
    phone?: string,
    situationResults?: any,
  ): Promise<Followup> => {
    situationResults ??= await simulation.compute()
    const benefits = situationResults.droitsEligibles.map((benefit) => ({
      id: benefit.id,
      amount: benefit.montant,
      unit: benefit.unit,
    }))
    return await FollowupFactory.create(simulation, {
      surveyOptin,
      email,
      phone,
      benefits,
    })
  },
}
