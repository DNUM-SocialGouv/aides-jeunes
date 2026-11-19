import { expect, vi } from "vitest"

import { FollowupFactory } from "@backend/lib/followup-factory.js"
import Followups from "@backend/models/followup.js"
import utils from "@backend/lib/utils.js"

describe("FollowupFactory", () => {
  describe("createWithResults", () => {
    let mockCompute,
      mockSimulation,
      mockEmail,
      mockSurveyOptin,
      mockAccessToken,
      mockGenerateToken,
      mockFollowupCreate

    beforeEach(() => {
      vi.clearAllMocks()
      // Mock dependencies
      mockCompute = vi.fn().mockImplementation(() => {
        return {
          droitsEligibles: [
            { id: "1", montant: 100, unit: "month" },
            { id: "2", montant: 200, unit: "month" },
          ],
        }
      })

      mockSimulation = {
        compute: mockCompute,
        hasFollowup: false,
        save: vi.fn().mockImplementation(async () => {
          await mockGenerateToken()
        }),
      }

      mockEmail = "test@example.com"
      mockSurveyOptin = true

      mockAccessToken = "access-token"
      mockGenerateToken = vi.spyOn(utils, "generateToken")
      mockGenerateToken.mockResolvedValue(mockAccessToken)

      mockFollowupCreate = vi.spyOn(Followups, "create")
      mockFollowupCreate.mockResolvedValue({})
    })

    afterEach(() => {
      vi.clearAllMocks()
      vi.restoreAllMocks()
    })

    it("should call compute once", async () => {
      await FollowupFactory.createWithResults(
        mockSimulation,
        mockSurveyOptin,
        mockEmail,
      )
      expect(mockCompute).toHaveBeenCalledTimes(1)
    })

    it("should not call compute when results are provided", async () => {
      await FollowupFactory.createWithResults(
        mockSimulation,
        mockSurveyOptin,
        mockEmail,
        undefined,
        { droitsEligibles: [{ id: "1", montant: 100, unit: "month" }] },
      )
      expect(mockCompute).not.toHaveBeenCalled()
      expect(mockFollowupCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          benefits: [{ id: "1", amount: 100, unit: "month" }],
        }),
      )
    })

    it("should call generateToken twice", async () => {
      // Note: generateToken is called twice because it is also called in the
      // simulation pre-save hook.
      await FollowupFactory.createWithResults(
        mockSimulation,
        mockSurveyOptin,
        mockEmail,
      )
      expect(mockGenerateToken).toHaveBeenCalledTimes(2)
    })

    it("should call createWithResults with the correct data", async () => {
      await FollowupFactory.createWithResults(
        mockSimulation,
        mockSurveyOptin,
        mockEmail,
      )
      expect(mockFollowupCreate).toHaveBeenCalledWith({
        simulation: mockSimulation,
        email: mockEmail,
        surveyOptin: mockSurveyOptin,
        accessToken: mockAccessToken,
        benefits: [
          { id: "1", amount: 100, unit: "month" },
          { id: "2", amount: 200, unit: "month" },
        ],
        version: 6,
      })
    })

    it("should set hasFollowup to true", async () => {
      await FollowupFactory.createWithResults(
        mockSimulation,
        mockSurveyOptin,
        mockEmail,
      )
      expect(mockSimulation.hasFollowup).toBe(true)
    })

    it("should call save once", async () => {
      await FollowupFactory.createWithResults(
        mockSimulation,
        mockSurveyOptin,
        mockEmail,
      )
      expect(mockSimulation.save).toHaveBeenCalledTimes(1)
    })

    describe("when the simulation compute fails", () => {
      beforeEach(() => {
        mockCompute = vi.fn().mockRejectedValue(new Error("Compute error"))

        mockSimulation = {
          compute: mockCompute,
          hasFollowup: false,
          save: vi.fn(),
        }
      })

      it("throws an error", async () => {
        await expect(
          FollowupFactory.createWithResults(
            mockSimulation,
            mockSurveyOptin,
            mockEmail,
          ),
        ).rejects.toThrow("Compute error")
      })
    })
  })
})
