import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import pkg from "./package.json" with { type: "json" };

// GitHub Pages project site: https://the-toolsgit.github.io/blue-fit/
const base = "/blue-fit/";

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        name: "Blue Fit",
        short_name: "Blue Fit",
        description: "Plan, log and track training.",
        theme_color: "#05070d",
        background_color: "#05070d",
        display: "standalone",
        orientation: "portrait",
        start_url: base,
        scope: base,
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: { globPatterns: ["**/*.{js,css,html,svg,png,woff2}"], globIgnores: ["**/*.woff", "**/launch/**"], navigateFallback: base + "index.html" },
    }),
  ],
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
