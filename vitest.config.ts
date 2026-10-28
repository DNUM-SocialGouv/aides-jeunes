import { defineConfig } from "vitest/config"
import vue from "@vitejs/plugin-vue"
import path from "path"

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["tests/**/*.spec.ts"],
    setupFiles: [],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@root": path.resolve(import.meta.dirname, "./"),
      "@backend": path.resolve(import.meta.dirname, "./backend"),
      "@lib": path.resolve(import.meta.dirname, "./lib"),
    },
  },
})
