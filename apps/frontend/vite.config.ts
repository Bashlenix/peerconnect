import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// GitHub Codespaces sets CODESPACES=true. There the app is reached via
// https://<name>-5173.app.github.dev, so Vite must (1) accept that Host header
// (its dev-server host check otherwise returns "Blocked request") and (2) run
// its HMR websocket over wss:443 instead of the local port.
const isCodespaces = process.env["CODESPACES"] === "true";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: [".app.github.dev"],
    ...(isCodespaces ? { hmr: { clientPort: 443 } } : {}),
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
});
