import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const server=await createServer({configFile:false,cacheDir:root+'/node_modules/.vite-inspections',root:root+'/tests/fixtures',plugins:[react()],server:{host:'127.0.0.1',port:4183,strictPort:true,fs:{allow:[root]}}});
await server.listen();console.log('Fictional inspection verification: http://127.0.0.1:4183/fire-inspections.html');
