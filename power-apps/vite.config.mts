import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));
const repository = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig(({ command, isPreview }) => {
  const local = command === "serve" && !isPreview;
  const target = process.env.FIREHOUSE_REVIEW_BACKEND;
  if (local && (!target || !/^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(target))) {
    throw new Error("Set FIREHOUSE_REVIEW_BACKEND to the loopback HTTP URL of the isolated Firehouse Manager backend.");
  }
  return {
    root,
    base: local ? "/power-apps/" : "./",
    plugins: [react()],
    build: { outDir: "../dist/power-apps", emptyOutDir: true },
    server: {
      host: "127.0.0.1",
      fs: { allow: [repository] },
      proxy: target ? {
        "^/(?!power-apps(?:/|$))": { target, changeOrigin: false },
      } : undefined,
    },
  };
});
