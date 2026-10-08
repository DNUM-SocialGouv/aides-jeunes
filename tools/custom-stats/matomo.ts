import axios from "axios"

import config from "../../backend/config/index.js"

export async function callMatomo(params: Record<string, string | number>) {
  const { data } = await axios.get(`${config.matomo.url}/index.php`, {
    params: {
      module: "API",
      format: "JSON",
      filter_limit: -1,
      token_auth: "anonymous",
      idSite: 63, // site de production
      period: "month",
      ...params,
    },
  })
  return data
}

// Les rapports mensuels sont plus à jour et moins tronqués (ligne "Autres")
// que le rapport annuel : on somme donc les statistiques mois par mois.
export function monthsOf(year: number) {
  return Array.from(
    { length: 12 },
    (_, index) => `${year}-${String(index + 1).padStart(2, "0")}-01`,
  )
}
