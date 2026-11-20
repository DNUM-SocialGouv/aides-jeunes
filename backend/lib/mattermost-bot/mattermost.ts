import axios from "axios"
import config from "../../config/index.js"
import { ErrorName } from "../../../lib/enums/error.js"

// Une configuration absente n'est pas une panne passagère : la distinguer évite
// d'inviter un appelant à réessayer ce qu'aucune tentative ne réparera.
export class MattermostNotConfiguredError extends Error {
  constructor() {
    super(
      "MATTERMOST_POST_URL n'est pas renseignée : notification non envoyée.",
    )
    this.name = ErrorName.MattermostNotConfiguredError
  }
}

async function post(text: string, postUrl?: string) {
  const url = postUrl || config.mattermost_post_url
  if (!url) {
    throw new MattermostNotConfiguredError()
  }

  await axios.post(url, JSON.stringify({ text }), {
    headers: {
      "Content-Type": "application/json",
    },
  })
}

export default { post }
