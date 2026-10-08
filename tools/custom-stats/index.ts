// Statistiques ponctuelles (Matomo...) demandées par les partenaires
//
// Usage : npm run tools:custom-stats
//
// Pour ajouter une statistique : créer un fichier dans ce dossier qui exporte
// { label, run } et l'ajouter à la liste STATS.
import select from "@inquirer/select"

interface Stat {
  label: string
  run: () => Promise<void>
}

const STATS: Stat[] = []

async function main() {
  const stat = await select({
    message: "Quelle statistique souhaitez-vous afficher ?",
    choices: STATS.map((stat) => ({ name: stat.label, value: stat })),
  })
  console.log(`\n${stat.label}\n`)
  await stat.run()
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
