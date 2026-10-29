import { Request, Response } from "express"
import Simulation from "../models/simulation.js"
import benefits from "../../data/all.js"
import departementsData from "@etalab/decoupage-administratif/data/departements.json" with { type: "json" }
import regionsData from "@etalab/decoupage-administratif/data/regions.json" with { type: "json" }

// ─── Mapping région → départements (via @etalab/decoupage-administratif) ──────
// Chaque département a un champ `region` contenant le code INSEE de sa région.
// On construit l'inverse : code_region → [code_dept, ...]

interface EtalabDept {
  code: string
  region: string
  nom: string
}

const regionToDepts: Record<string, string[]> = {}
for (const dept of departementsData as EtalabDept[]) {
  if (!regionToDepts[dept.region]) regionToDepts[dept.region] = []
  regionToDepts[dept.region].push(dept.code)
}

// Noms des régions pour l'affichage
const regionNames: Record<string, string> = {}
for (const region of regionsData as { code: string; nom: string }[]) {
  regionNames[region.code] = region.nom
}

// Noms des départements pour l'affichage
const deptNames: Record<string, string> = {}
for (const dept of departementsData as EtalabDept[]) {
  deptNames[dept.code] = dept.nom
}

// ─── Extraction code département depuis code commune (depcom) ─────────────────

function depcomToDept(depcom: string): string {
  if (!depcom || typeof depcom !== "string") return "france-entiere"
  const clean = depcom.trim()
  if (clean.startsWith("2A") || clean.startsWith("2B"))
    return clean.substring(0, 2).toUpperCase()
  if (/^(971|972|973|974|976)/.test(clean)) return clean.substring(0, 3)
  const dept = clean.substring(0, 2)
  return dept || "france-entiere"
}

// ─── Types d'institutions locales à ventiler ──────────────────────────────────

const LOCAL_INSTITUTION_TYPES = [
  "region",
  "departement",
  "commune",
  "epci",
  "caf",
  "msa",
  "autre",
  "europeen",
]

interface BenefitsByType {
  [institutionType: string]: number
}

interface DeptBenefitDetail {
  byType: BenefitsByType
  benefitNames: string[]
  total: number
}

// ─── Résoudre les départements couverts par une institution ───────────────────

function resolveInstitutionDepts(institution: any): string[] {
  const iType = institution.type

  // Institution régionale : résoudre via le mapping etalab
  if (iType === "region" && institution.code_insee) {
    return regionToDepts[institution.code_insee] || []
  }

  // Institution départementale sans champ departments : utiliser code_insee
  if (
    iType === "departement" &&
    institution.code_insee &&
    !institution.departments
  ) {
    return [institution.code_insee]
  }

  // Institution avec un champ departments explicite (CAF locale, EPCI, commune, etc.)
  if (institution.departments) {
    const depts: string[] =
      typeof institution.departments === "string"
        ? institution.departments.split(",").map((d: string) => d.trim())
        : Array.isArray(institution.departments)
          ? institution.departments
          : []
    return depts
  }

  return []
}

// ─── Comptage des aides par département ───────────────────────────────────────

function countBenefitsByDept(): {
  national: number
  byDept: Record<string, DeptBenefitDetail>
} {
  const national = { count: 0 }
  const byDept: Record<string, DeptBenefitDetail> = {}

  for (const benefit of benefits.all) {
    const institution = benefit.institution
    if (!institution) continue

    const iType = institution.type

    // Aides nationales pures (État, CAF nationale, etc.)
    if (iType === "national") {
      national.count += 1
      continue
    }

    // Résoudre les départements pour cette institution
    const depts = resolveInstitutionDepts(institution)

    if (depts.length === 0) {
      // Institution locale sans résolution possible → compter en national par défaut
      national.count += 1
      continue
    }

    const benefitLabel = benefit.label || benefit.id || "Aide sans nom"
    const typeKey = LOCAL_INSTITUTION_TYPES.includes(iType) ? iType : "autre"

    for (const dept of depts) {
      if (!byDept[dept]) {
        byDept[dept] = { byType: {}, benefitNames: [], total: 0 }
      }
      byDept[dept].byType[typeKey] = (byDept[dept].byType[typeKey] || 0) + 1
      byDept[dept].benefitNames.push(benefitLabel)
      byDept[dept].total += 1
    }
  }

  return { national: national.count, byDept }
}

// ─── Endpoint /api/stats/map ──────────────────────────────────────────────────

export async function mapStats(req: Request, res: Response) {
  try {
    // Agréger les simulations par département depuis MongoDB
    const simulationsByDept = await Simulation.aggregate([
      {
        $addFields: {
          depcomAnswer: {
            $filter: {
              input: "$answers.all",
              as: "ans",
              cond: { $eq: ["$$ans.fieldName", "depcom"] },
            },
          },
        },
      },
      {
        $addFields: {
          depcom: { $arrayElemAt: ["$depcomAnswer.value", 0] },
        },
      },
      {
        $group: {
          _id: "$depcom",
          count: { $sum: 1 },
        },
      },
    ])

    // Transformer en map dept -> count
    const simulationsMap: Record<string, number> = {}
    let franceEntiereCount = 0

    for (const entry of simulationsByDept) {
      if (!entry._id) {
        franceEntiereCount += entry.count
        continue
      }
      const dept = depcomToDept(String(entry._id))
      if (dept === "france-entiere") {
        franceEntiereCount += entry.count
      } else {
        simulationsMap[dept] = (simulationsMap[dept] || 0) + entry.count
      }
    }

    // Compter les aides par département avec détail par type d'institution
    const benefitCounts = countBenefitsByDept()
    const nationalBenefits = benefitCounts.national
    const totalBenefits = benefits.all.length

    // Union de tous les départements connus
    const allDepts = new Set([
      ...Object.keys(simulationsMap),
      ...Object.keys(benefitCounts.byDept),
    ])

    const departments = Array.from(allDepts).map((dept) => {
      const local = benefitCounts.byDept[dept] || {
        byType: {},
        benefitNames: [],
        total: 0,
      }
      return {
        code: dept,
        name: deptNames[dept] || `Département ${dept}`,
        simulations: simulationsMap[dept] || 0,
        nationalBenefits,
        localBenefits: local.total,
        localByType: local.byType,
        localBenefitNames: local.benefitNames,
        totalBenefits: local.total + nationalBenefits,
      }
    })

    // Calculer le total d'aides locales (en comptant les aides uniques, pas les distributions)
    const uniqueLocalBenefits = new Set<string>()
    for (const detail of Object.values(benefitCounts.byDept)) {
      for (const name of detail.benefitNames) {
        uniqueLocalBenefits.add(name)
      }
    }

    res.json({
      departments,
      franceEntiere: {
        simulations: franceEntiereCount,
        nationalBenefits,
        localBenefits: 0,
        localByType: {},
        totalBenefits,
      },
      totals: {
        simulations:
          Object.values(simulationsMap).reduce((a, b) => a + b, 0) +
          franceEntiereCount,
        benefits: totalBenefits,
        nationalBenefits,
        localBenefitsTotal: uniqueLocalBenefits.size,
      },
    })
  } catch (err) {
    console.error("[stats/map] Erreur:", err)
    res
      .status(500)
      .json({ error: "Erreur lors du chargement des statistiques" })
  }
}

export default { mapStats }
