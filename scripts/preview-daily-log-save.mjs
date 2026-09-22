import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

// Isolated client preview; no real API, authentication or database connections.
const server = await createServer({ configFile: false, root: process.cwd(), plugins: [react()],
  server: { host: '127.0.0.1', port: 4198, strictPort: true, watch: { ignored: ['**/.next/**', '**/outputs/**'] } },
});
await server.listen();
console.log('Fictional Daily Log: http://127.0.0.1:4198/tests/fixtures/daily-log-save.html');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await server.close(); process.exit(0); });
