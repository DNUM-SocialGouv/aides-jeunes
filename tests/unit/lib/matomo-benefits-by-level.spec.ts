import { expect } from "vitest"
import { countDisplaysByLevel } from "@lib/matomo-benefits-by-level.js"

describe("countDisplaysByLevel", () => {
  it("should count displays by level, CAF being departemental", () => {
    const displays = [
      { id: "aide-nationale", count: 4 },
      { id: "aide-nationale", count: 2 },
      { id: "caf-aube-aide-bafa-generale", count: 2 },
    ]
    const levelsById = {
      "aide-nationale": "national",
      "caf-aube-aide-bafa-generale": "caf",
    }

    expect(countDisplaysByLevel(displays, levelsById)).toEqual([
      { label: "Aides nationales", count: 6, percentage: 75 },
      { label: "Aides départementales", count: 2, percentage: 25 },
    ])
  })
})
