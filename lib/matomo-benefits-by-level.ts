// Répartition par échelon (type d'institution) des affichages de dispositifs
// dans les pages de résultats, à partir de l'événement Matomo "show".
import { institutionTypesLabels } from "./institution-types.js"

const LEVEL_LABELS: Record<string, string> = {
  ...institutionTypesLabels,
  "non-detaille": "Non détaillé par Matomo",
  inconnu: "Échelon non retrouvé",
}

function getLevel(benefitId: string, levelsById: Record<string, string>) {
  // Matomo regroupe les lignes au-delà de sa limite de troncature dans "Autres"
  if (benefitId === "Autres") {
    return "non-detaille"
  }
  const level = levelsById[benefitId] || "inconnu"
  // Les CAF sont des organismes départementaux
  return level === "caf" ? "departement" : level
}

export function countDisplaysByLevel(
  displays: { id: string; count: number }[],
  levelsById: Record<string, string>,
) {
  const counts: Record<string, number> = {}
  for (const { id, count } of displays) {
    const level = getLevel(id, levelsById)
    counts[level] = (counts[level] || 0) + count
  }
  const total = displays.reduce((sum, { count }) => sum + count, 0)
  return Object.entries(counts)
    .map(([level, count]) => ({
      label: LEVEL_LABELS[level] || level,
      count,
      percentage: (100 * count) / total,
    }))
    .sort((a, b) => b.count - a.count)
}
