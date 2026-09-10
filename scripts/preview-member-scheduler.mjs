// Isolated fictional UI fixture. No server routes or production credentials.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({ configFile: false, root: `${root}/tests/fixtures`, plugins: [react()], server: { host: '127.0.0.1', port: 4179, strictPort: true, fs: { allow: [root] } } });
await server.listen();
console.log('Fictional scheduler: http://127.0.0.1:4179/scheduler-mobile.html');
