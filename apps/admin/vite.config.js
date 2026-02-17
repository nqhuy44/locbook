import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.png",
        "apple-touch-icon.png",
        "pwa-dark-512x512.png",
      ],
      manifest: {
        name: "Spotary Admin",
        short_name: "SpotaryAdmin",
        description: "Admin Dashboard for Spotary",
        theme_color: "#000000",
        background_color: "#000000",
        icons: [
          {
            src: "pwa-dark-192x192x.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-dark-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/images": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
    host: true,
    allowedHosts: [
      "dev.firstdraft.sh",
      "localhost",
      "127.0.0.1",
      "100.69.194.28",
    ],
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
});
