import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  optimizeDeps: { entries: ["tests/fixtures/inventory-workflow-audit.html", "tests/fixtures/refresh-economy-audit.html"], include: ["next/link", "next/image", "@zxing/browser"] },
  server: { host: "127.0.0.1", port: 5188, watch: { ignored: ["**/.next/**"] } },
});
