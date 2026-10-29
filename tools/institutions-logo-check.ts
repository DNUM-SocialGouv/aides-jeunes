import data from "../data/all.js"
import express from "express"
import { __express } from "ejs"

const port = 9090
const app = express()
app.engine(".html", __express)
app.set("views", `${new URL(".", import.meta.url).pathname}/views`)
app.set("view engine", "html")
app.use(express.static("public"))

app.route("/").get(function (req, res) {
  res.render("institutions", {
    institutions: Object.values(data.institutionsMap).map((institution) => {
      return {
        image: institution.imgSrc,
        title: institution.label,
      }
    }),
  })
})

app.listen(port, () => console.log(`The server is listening on port ${port}`))
