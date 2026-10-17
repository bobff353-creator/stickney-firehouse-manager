// Local synthetic portal and inventory previews. No API server or hosted data.
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const server=await createServer({configFile:false,root:root+'tests/fixtures',publicDir:root+'public',cacheDir:root+'node_modules/.vite-app-readability',plugins:[react()],resolve:{alias:{'next/image':root+'tests/fixtures/next-image-stub.tsx'}},server:{host:'127.0.0.1',port:4191,strictPort:true,fs:{allow:[root]}}});
await server.listen();
console.log('Synthetic app preview: http://127.0.0.1:4191/portal-audit.html?display=portal&visual-audit=1&readability=1&page=dashboard');
