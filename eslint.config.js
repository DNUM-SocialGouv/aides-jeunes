import { defineConfig, globalIgnores } from "eslint/config"

import globals from "globals"

import { fixupConfigRules, fixupPluginRules } from "@eslint/compat"

import cypress from "eslint-plugin-cypress"
import prettier from "eslint-plugin-prettier"
import vue from "eslint-plugin-vue"
import typescriptEslint from "@typescript-eslint/eslint-plugin"
import js from "@eslint/js"

import { FlatCompat } from "@eslint/eslintrc"
import { fileURLToPath } from "url"
import { dirname } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
})

export default defineConfig([
  ...fixupConfigRules(
    compat.extends(
      "eslint:recommended",
      "plugin:vue/vue3-essential",
      "plugin:@typescript-eslint/recommended",
      "plugin:vue/vue3-recommended",
      "plugin:prettier-vue/recommended",
      "prettier",
      "plugin:import/recommended",
    ),
  ),
  cypress.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        Atomics: "readonly",
        SharedArrayBuffer: "readonly",
      },

      ecmaVersion: 2018,
      sourceType: "module",

      parserOptions: {
        parser: "@typescript-eslint/parser",
      },
    },

    plugins: {
      prettier,
      vue: fixupPluginRules(vue),
      "@typescript-eslint": fixupPluginRules(typescriptEslint),
    },

    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/no-unused-vars": ["error"],

      "@typescript-eslint/naming-convention": [
        "warn",
        {
          selector: ["interface", "enum", "enumMember", "typeAlias"],
          format: ["PascalCase"],
        },
      ],

      "@typescript-eslint/no-duplicate-enum-values": "warn",
      "import/named": "off",
      "import/no-unresolved": "off",
      "no-irregular-whitespace": 0,
      "vue/multi-word-component-names": "off",
      "vue/no-v-html": "off",
      "vue/require-default-prop": "off",
    },
  },
  globalIgnores([
    "**/contribuer",
    "**/dist",
    "**/dist-server",
    "**/IndividuForm.vue",
    "**/*.min.js",
    "**/node_modules",
    "test/integration",
    "**/.tmp",
    "**/tmp",
  ]),
  {
    files: ["**/__tests__/*.{j,t}s?(x)"],

    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
])
