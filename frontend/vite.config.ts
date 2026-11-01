import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL(".", import.meta.url));
export default defineConfig({
  root,
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": `${root}src` } },
  envPrefix: "VITE_PUBLIC_",
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:3000" },
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    proxy: { "/api": "http://127.0.0.1:3000" },
  },
  build: {
    outDir: "../dist/frontend",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("recharts") || id.includes("d3-")) return "charts";
            if (id.includes("@dnd-kit")) return "dnd";
            if (id.includes("motion")) return "motion";
            if (
              id.includes("react-dom") ||
              id.includes("react-router") ||
              /[/\\]react[/\\]/.test(id)
            )
              return "react";
          }
        },
      },
    },
  },
});
