// Local synthetic preview only. No application API or hosted data access.
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const server=await createServer({configFile:false,root:root+'tests/fixtures',cacheDir:root+'node_modules/.vite-callback-design',plugins:[react()],server:{host:'127.0.0.1',port:4187,strictPort:true,fs:{allow:[root]}}});
await server.listen();
console.log('Synthetic callback design preview: http://127.0.0.1:4187/callback-design.html');
