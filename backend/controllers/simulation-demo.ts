import axios from "axios"

let data = null

const artifactName = "cypress-json-base"

async function getArtifactMetadata() {
  const artifactListResponse = await axios.get(
    "https://api.github.com/repos/DNUM-SocialGouv/aides-jeunes/actions/artifacts",
  )
  const artifactListPayload = artifactListResponse.data
  const releventArtifacts = artifactListPayload.artifacts.filter((artifact) => {
    return (
      artifact.name === artifactName &&
      artifact.workflow_run.head_branch === "main"
    )
  })
  return releventArtifacts.length ? releventArtifacts[0] : null
}

async function fetchArtifactZip() {
  if (data) {
    return data
  }
  const metadata = await getArtifactMetadata()
  if (!metadata) {
    return
  }

  // CORS + anonymous access issues on GitHub API directly
  const url = `https://nightly.link/DNUM-SocialGouv/aides-jeunes/actions/runs/${metadata.workflow_run.id}/${artifactName}.zip`
  const artifact = await axios.get(url, {
    responseType: "arraybuffer",
  })

  data = artifact.data
  return data
}

async function get(req, res) {
  const zipBlob = await fetchArtifactZip()
  res.attachment("payload.zip")
  res.send(zipBlob)
}

export default {
  get,
}
