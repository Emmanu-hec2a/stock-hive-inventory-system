import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiBaseUrl = env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";
  const apiUrl = new URL(apiBaseUrl);
  const apiPrefix = apiUrl.pathname.replace(/\/$/, "");

  return {
    plugins: [
      react(),
      VitePWA({
        injectRegister: false,
        registerType: "autoUpdate",
        devOptions: {
          enabled: true,
        },
        includeAssets: [
          "favicon.ico",
          "masked-icon.svg",
          "icons/apple-touch-icon.png",
          "icons/favicon-16x16.png",
          "icons/favicon-32x32.png",
          "icons/og-image.png",
        ],
        manifest: {
          id: "/",
          name: "StockHive",
          short_name: "StockHive",
          description: "Multi-branch inventory management for retail & wholesale shops",
          theme_color: "#f59e0b",
          background_color: "#0d0f12",
          display: "standalone",
          orientation: "portrait",
          scope: "/",
          start_url: "/",
          categories: ["business", "productivity", "shopping"],
          icons: [
            { src: "/icons/icon-72x72.png", sizes: "72x72", type: "image/png" },
            { src: "/icons/icon-96x96.png", sizes: "96x96", type: "image/png" },
            { src: "/icons/icon-128x128.png", sizes: "128x128", type: "image/png" },
            { src: "/icons/icon-144x144.png", sizes: "144x144", type: "image/png" },
            { src: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
            { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
            { src: "/icons/icon-384x384.png", sizes: "384x384", type: "image/png" },
            { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
          ],
          shortcuts: [
            {
              name: "Record Sale",
              short_name: "Sale",
              description: "Go directly to record a new sale",
              url: "/sales/new",
              icons: [{ src: "/icons/shortcut-sale.png", sizes: "96x96", type: "image/png" }],
            },
            {
              name: "Check Stock",
              short_name: "Stock",
              description: "View current stock levels",
              url: "/stock",
              icons: [{ src: "/icons/shortcut-stock.png", sizes: "96x96", type: "image/png" }],
            },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          navigateFallback: "index.html",
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: ({ request, url }) =>
                request.method === "GET"
                && url.origin === apiUrl.origin
                && (
                  url.pathname.startsWith(`${apiPrefix}/products`)
                  || url.pathname.startsWith(`${apiPrefix}/stock`)
                  || url.pathname.startsWith(`${apiPrefix}/sales`)
                  || url.pathname.startsWith(`${apiPrefix}/reports/`)
                  || url.pathname.startsWith(`${apiPrefix}/alerts/notifications`)
                ),
              handler: "NetworkFirst",
              options: {
                cacheName: "api-cache",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24,
                },
                networkTimeoutSeconds: 5,
              },
            },
            {
              urlPattern: ({ request }) =>
                request.destination === "script"
                || request.destination === "style"
                || request.destination === "image"
                || request.destination === "font",
              handler: "CacheFirst",
              options: {
                cacheName: "static-assets",
                expiration: {
                  maxEntries: 80,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts",
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
          ],
        },
      }),
    ],
  };
});
