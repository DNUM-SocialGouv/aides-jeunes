import fs from "fs"
import config from "../backend/config/index.js"
import generator from "../data/all.js"
import path from "path"

const benefits = Object.keys(generator.benefitsMap)
  .filter((benefit) => !generator.benefitsMap[benefit]?.private)
  .map((benefit) => ({
    location: `aides/${benefit}`,
    priority: "0.0",
  }))

const pages = [
  {
    location: ``,
    priority: "1.0",
  },
  {
    location: `simulation`,
    priority: "0.5",
  },
  {
    location: `contact`,
    priority: "0.3",
  },
  {
    location: `accessibilite`,
    priority: "0.1",
  },
  {
    location: `cgu`,
    priority: "0.1",
  },
  {
    location: `mentions-legales`,
    priority: "0.1",
  },
  {
    location: `confidentialite`,
    priority: "0.1",
  },
  {
    location: `stats`,
    priority: "0.1",
  },
  {
    location: `iframe`,
    priority: "0.1",
  },
  {
    location: `aides`,
    priority: "0.1",
  },
  ...benefits,
]
function formatXMLEntries(pages) {
  return `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${pages
    .map(
      (entry) =>
        `  <url>
      <loc>${config.baseURL}/${entry.location}</loc>
      <priority>${entry.priority}</priority>
    </url>`,
    )
    .join("\n  ")}
</urlset>
`
}

export default () => {
  return {
    name: "xml sitemap generator",
    closeBundle: () => {
      fs.writeFileSync(
        path.join(import.meta.dirname, `../dist/sitemap.xml`),
        formatXMLEntries(pages),
      )
    },
  }
}
