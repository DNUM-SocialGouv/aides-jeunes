import { expect } from "vitest"
import fs from "fs"
import path from "path"

interface FileProperties {
  filename: string
  absolute: string
  extension: string
}

const projectRoot = path.resolve(import.meta.dirname, "../..")

describe("Test filenames rules", function () {
  const files: FileProperties[] = []

  function getFiles(dir) {
    const currentFiles = fs.readdirSync(dir)
    currentFiles.forEach((filename) => {
      if (
        ["dist", "dist-server", "node_modules", "out"].includes(filename) ||
        filename.startsWith(".")
      ) {
        return
      }
      const absolute = path.join(dir, filename)
      if (fs.lstatSync(absolute).isDirectory()) {
        return getFiles(absolute)
      } else {
        const splitFilename = filename.split(".")
        const nameWithoutExtension = splitFilename
          .slice(0, splitFilename.length - 1)
          .join("")
        const extension = splitFilename[splitFilename.length - 1]

        return files.push({
          filename: nameWithoutExtension,
          absolute,
          extension,
        })
      }
    })
  }

  getFiles(projectRoot)

  const result = files.filter((file) => {
    return ["ts", "js", "vue"].includes(file.extension)
  })

  result.forEach((file) => {
    describe(file.absolute, function () {
      it("should respect kebab-case rule", function () {
        expect(
          file.filename.match(/^(_?)([a-z][a-z0-9]*)(-[a-z0-9]+)*$/),
        ).toBeTruthy()
      })
    })
  })

  const benefitsFiles = files.filter((file) =>
    file.absolute.match(
      /data\/(institutions|benefits\/(javascript|openfisca))/,
    ),
  )
  benefitsFiles.forEach((file) => {
    describe(file.absolute, function () {
      it("institution and benefit files should use yml extension", function () {
        expect(file.extension === "yml").toBeTruthy()
      })
    })
  })
})
