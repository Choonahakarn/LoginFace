import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // Enable Hot Module Replacement (HMR) - reload automatically on code changes
    hmr: {
      overlay: true, // Show error overlay in browser
    },
    watch: {
      // Watch for file changes and reload automatically
      usePolling: false, // Use native file system events (faster)
    },
  },
});
