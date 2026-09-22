// Local UI rehearsal only. API traffic is intercepted by the fictional fixture.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
const server = await createServer({
  configFile: false, root: process.cwd(), plugins: [react()],
  server: { host: '127.0.0.1', port: 4199, strictPort: true, watch: { ignored: ['**/.next/**', '**/.git/**'] } },
});
await server.listen();
console.log('Fictional inventory preview: http://127.0.0.1:4199/tests/fixtures/inventory-workflow-audit.html');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await server.close(); process.exit(0); });
