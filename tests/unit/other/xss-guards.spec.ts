import { describe, expect, it } from "vitest"
import { generateSituation } from "@root/lib/situations.js"
import Hint from "@/lib/hint.js"

describe("Garde-fous contre l'injection HTML", () => {
  it("Hint ignore les clés héritées du prototype", () => {
    const segments = ["<img src=x onerror=alert(1)>", "constructor"]
    expect(Hint.get("constructor", segments as any)).toBeUndefined()
    expect(Hint.get("__proto__")).toBeUndefined()
  })

  it("le prénom d'un enfant est débarrassé de ses chevrons", () => {
    const situation = generateSituation({
      dateDeValeur: new Date("2024-01-01"),
      enfants: [0],
      answers: {
        all: [],
        current: [
          {
            id: "enfant_0",
            entityName: "individu",
            fieldName: "_firstName",
            value: "<img src=x onerror=alert(1)>Léa",
          },
        ],
      },
    })
    expect(situation.enfants?.[0]._firstName).toBe(
      "img src=x onerror=alert(1)Léa",
    )
  })
})
