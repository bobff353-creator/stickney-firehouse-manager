import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Limit dependency discovery to this isolated UI test, not every portal fixture.
export default defineConfig({
  plugins: [react()],
  optimizeDeps: { entries: ['tests/fixtures/scheduler-preview.html'] },
  server: { host: '127.0.0.1', port: 5186, watch: { ignored: ['**/.next/**'] } },
});
