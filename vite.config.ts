import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  server: {
    proxy: {
      "/api": {
        // target: "http://localhost:8080",
        target: "http://107.210.222.39:9090",
        // POST /cctv/analyse blocks for the whole analysis — the server itself
        // waits up to thirty minutes before giving up. Every proxy in front of
        // it has to be told, or a healthy run dies at whatever round number
        // that proxy defaults to and the API gets blamed for it. This covers
        // the dev server only; the deployed ingress needs the same raised.
        timeout: 36 * 60 * 1000,
        proxyTimeout: 36 * 60 * 1000,
      },
    },
  },

  plugins: [
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
});
