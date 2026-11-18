import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { powerApps } from "@microsoft/power-apps-vite/plugin";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('..', import.meta.url)), '');
  const publicConfiguration = Object.fromEntries([
    'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_AUTH_ORIGIN',
  ].map(key => [`process.env.${key}`, JSON.stringify(env[key] ?? '')]));
  return {
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  define: { ...publicConfiguration, 'import.meta.env.VITE_POWER_APPS_BACKEND_URL': JSON.stringify(env.VITE_POWER_APPS_BACKEND_URL ?? '') },
  plugins: [{ name: 'standalone-review-adapters', enforce: 'pre', resolveId(source, importer) {
    if (source === './payroll-app' && importer?.replaceAll('\\', '/').endsWith('/app/auth-gateway.tsx')) return fileURLToPath(new URL('./workspace.tsx', import.meta.url));
    if (/^(?:\.\.\/|\.\/).*supabase-browser$/.test(source)) return fileURLToPath(new URL('./supabase-browser.ts', import.meta.url));
  } }, react(), powerApps()],
  build: { outDir: "../dist/power-apps", emptyOutDir: true },
};
});
