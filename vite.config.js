import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["pwa-192.png", "pwa-512.png", "config.js"],
      manifest: {
        name: "London, on foot",
        short_name: "London",
        description: "Track every London neighbourhood and green space you've explored.",
        theme_color: "#16161A",
        background_color: "#FFFFFF",
        display: "standalone",
        start_url: "./",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallback: "index.html",
        runtimeCaching: [
          { urlPattern: /basemaps\.cartocdn\.com/, handler: "CacheFirst", options: { cacheName: "tiles", expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 } } },
          { urlPattern: /en\.wikipedia\.org/, handler: "StaleWhileRevalidate", options: { cacheName: "wiki" } },
          { urlPattern: /fonts\.(googleapis|gstatic)\.com/, handler: "CacheFirst", options: { cacheName: "fonts", expiration: { maxEntries: 30 } } },
        ],
      },
    }),
  ],
});
