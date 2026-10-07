/*
 Script: add-milestone-to-merged-prs.ts
 Objectif: appliquer un milestone à toutes les PRs TERMINÉES (mergées ou fermées) dont la date de fin (closed_at ou merged) tombe dans une fenêtre temporelle. Les PR ouvertes sont ignorées.

 Options:
   --milestone "Titre"    (obligatoire)
   --from YYYY-MM-DD       (début inclus)  | exclusif avec --month
   --to YYYY-MM-DD         (fin inclus)    | exclusif avec --month
   --month YYYY-MM         (calcule from/to automatiquement)
   --dry-run               (simulation sans écriture)
   --verbose               (logs supplémentaires)

 Exemples:
   npm run tools:add-milestone -- --milestone 'BC juin 2025' --month 2025-06 --verbose --dry-run
   npm run tools:add-milestone -- --milestone 'BC avril-mai 2025' --from 2025-04-01 --to 2025-05-31 --verbose

 Bonnes pratiques:
   - Toujours lancer un dry-run avant application réelle.
*/

import process from "node:process"
import { execSync } from "node:child_process"
import { setTimeout as delay } from "node:timers/promises"

interface Args {
  milestone: string
  from: string
  to: string
  month?: string
  dryRun: boolean
  verbose: boolean
}

const OWNER = "DNUM-SocialGouv"
const REPO = "aides-jeunes"

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const args: Partial<Args> = {}
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--milestone":
        args.milestone = argv[++i]
        break
      case "--from":
        args.from = argv[++i]
        break
      case "--to":
        args.to = argv[++i]
        break
      case "--dry-run":
        args.dryRun = true
        break
      case "--verbose":
        args.verbose = true
        break
      case "--month":
        args.month = argv[++i]
        break
    }
  }
  if (!args.milestone) throw new Error("Argument --milestone obligatoire.")
  if (args.month) {
    if (args.from || args.to)
      throw new Error("Ne pas combiner --month avec --from/--to.")
    if (!/^\d{4}-\d{2}$/.test(args.month))
      throw new Error("Format attendu pour --month: YYYY-MM")
    const [year, month] = args.month.split("-").map(Number)
    const start = new Date(Date.UTC(year, month - 1, 1))
    const end = new Date(Date.UTC(year, month, 0))
    args.from = start.toISOString().slice(0, 10)
    args.to = end.toISOString().slice(0, 10)
  }
  if (!args.from)
    throw new Error("Argument --from manquant (ou fournir --month).")
  if (!args.to) throw new Error("Argument --to manquant (ou fournir --month).")
  return {
    milestone: args.milestone!,
    from: args.from!,
    to: args.to!,
    dryRun: !!args.dryRun,
    verbose: !!args.verbose,
    month: args.month,
  }
}

function resolveToken(): string {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim()
  try {
    return execSync("gh auth token", { encoding: "utf8" }).trim()
  } catch {
    throw new Error(
      "Token introuvable. Définir GITHUB_TOKEN ou exécuter 'gh auth login'.",
    )
  }
}

async function githubRequest<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const token = resolveToken()
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GitHub API ${res.status} ${res.statusText} -> ${text}`)
  }
  return res.json() as Promise<T>
}

async function findMilestoneId(title: string): Promise<number> {
  let page = 1
  while (true) {
    const milestones: any[] = await githubRequest<any[]>(
      `https://api.github.com/repos/${OWNER}/${REPO}/milestones?state=all&per_page=100&page=${page}`,
    )
    if (!milestones.length) break
    const found = milestones.find((m) => m.title === title)
    if (found) return found.number
    page++
    await delay(200)
  }
  throw new Error(`Milestone '${title}' introuvable. Le créer puis relancer.`)
}

interface SearchItem {
  number: number
  title: string
  created_at: string
  closed_at?: string
}

// Recherche des PR terminées dans la fenêtre par date de fin (merge ou fermeture)
async function searchFinishedPRs(
  from: string,
  to: string,
): Promise<SearchItem[]> {
  const range = `${from}..${to}`
  const queries = [
    `repo:${OWNER}/${REPO} is:pr merged:${range}`,
    `repo:${OWNER}/${REPO} is:pr is:closed -is:merged closed:${range}`,
  ]
  const all: Map<number, SearchItem> = new Map()
  for (const raw of queries) {
    // On URL-encode la requête GitHub Search pour l'injecter comme paramètre 'q'.
    const encodedQuery = encodeURIComponent(raw)
    let page = 1
    while (true) {
      const data = await githubRequest<{ items: SearchItem[] }>(
        `https://api.github.com/search/issues?q=${encodedQuery}&per_page=100&page=${page}`,
      )
      if (!data.items.length) break
      for (const it of data.items) all.set(it.number, it)
      if (data.items.length < 100) break
      page++
    }
  }
  return [...all.values()]
}

async function assignMilestone(
  prNumber: number,
  milestoneNumber: number,
  dryRun: boolean,
  verbose: boolean,
): Promise<void> {
  if (dryRun) {
    if (verbose)
      console.log(
        `[DRY-RUN] PATCH issue ${prNumber} milestone=${milestoneNumber}`,
      )
    return
  }
  await githubRequest(
    `https://api.github.com/repos/${OWNER}/${REPO}/issues/${prNumber}`,
    {
      method: "PATCH",
      body: JSON.stringify({ milestone: milestoneNumber }),
      headers: { "Content-Type": "application/json" },
    },
  )
  if (verbose) console.log(`Milestone appliqué à PR #${prNumber}`)
}

async function main() {
  const args = parseArgs()
  const milestoneId = await findMilestoneId(args.milestone)
  if (args.verbose)
    console.log(
      `Milestone: '${args.milestone}' -> ${milestoneId} | Fenêtre ${args.from}..${args.to}`,
    )
  const prs = await searchFinishedPRs(args.from, args.to)
  console.log(
    `PR terminées dans fenêtre ${args.from}..${args.to}: ${prs.length}`,
  )
  if (!prs.length) {
    console.log("Aucune PR à traiter.")
    return
  }
  let assigned = 0
  for (const pr of prs) {
    if (args.dryRun) {
      const creation = pr.created_at.slice(0, 10)
      const fin = pr.closed_at ? pr.closed_at.slice(0, 10) : "(ouverte)"
      console.log(
        `[DRY-RUN] #${pr.number} fin=${fin} créée=${creation} -> '${args.milestone}' | ${pr.title}`,
      )
    }
    await assignMilestone(pr.number, milestoneId, args.dryRun, args.verbose)
    assigned++
    await delay(100)
  }
  console.log(
    `Terminé. Milestone ${args.dryRun ? "simulé pour" : "appliqué à"} ${assigned} PR(s).`,
  )
}

main().catch((err) => {
  console.error("Erreur:", err.message)
  process.exit(1)
})
