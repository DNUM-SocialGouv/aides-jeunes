import { spawn } from "child_process"
import net from "net"

// Port local du tunnel, différent de 27017 pour ne pas interroger par erreur
// un MongoDB local
const LOCAL_PORT = 27018

// Serveur de production, comme dans .github/workflows/cd.yml
const SSH_HOST =
  process.env.MONGODB_SSH_HOST ||
  "debian@equinoxe.mes-aides.1jeune1solution.beta.gouv.fr"

export const PRODUCTION_MONGODB_URL = `mongodb://localhost:${LOCAL_PORT}/db_aides_jeunes`

function isPortOpen() {
  return new Promise((resolve) => {
    const socket = net.connect(LOCAL_PORT, "127.0.0.1")
    socket.on("connect", () => {
      socket.end()
      resolve(true)
    })
    socket.on("error", () => resolve(false))
  })
}

// Ouvre un tunnel SSH vers le MongoDB de production avec la clé SSH du poste,
// lance run, puis referme le tunnel.
export async function withSshTunnel(run: () => Promise<void>) {
  if (await isPortOpen()) {
    throw new Error(`Le port ${LOCAL_PORT} est déjà utilisé`)
  }

  // stderr affiché pour voir les erreurs et questions de ssh (passphrase...)
  const tunnel = spawn(
    "ssh",
    [
      "-N",
      "-o",
      "ExitOnForwardFailure=yes",
      "-L",
      `${LOCAL_PORT}:localhost:27017`,
      SSH_HOST,
    ],
    { stdio: ["inherit", "ignore", "inherit"] },
  )
  try {
    for (let attempt = 0; !(await isPortOpen()); attempt++) {
      if (attempt === 60 || tunnel.exitCode !== null) {
        throw new Error(`Impossible d'ouvrir le tunnel SSH vers ${SSH_HOST}`)
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    await run()
  } finally {
    tunnel.kill()
  }
}
