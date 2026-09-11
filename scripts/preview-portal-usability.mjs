import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({ configFile: false, root: `${root}/tests/fixtures`, publicDir: `${root}/public`, plugins: [react()], server: { host: '127.0.0.1', port: 4181, strictPort: true, fs: { allow: [root] } } });
await server.listen();
console.log('Fictional portal audit: http://127.0.0.1:4181/portal-audit.html');
