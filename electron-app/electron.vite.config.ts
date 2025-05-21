import { resolve } from "path"
import { defineConfig, externalizeDepsPlugin } from "electron-vite"
import { createRequire } from "module"

const require = createRequire(import.meta.url)
const reactPlugin = require("@vitejs/plugin-react").default

export default defineConfig({
  main:    { plugins: [externalizeDepsPlugin()] },
  preload: { plugins: [externalizeDepsPlugin()] },
  renderer: {
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src"),
        "@":         resolve("src/renderer/src"),
        "@shared":   resolve("src/shared"),
      },
    },
    plugins: [reactPlugin()],
  },
})
