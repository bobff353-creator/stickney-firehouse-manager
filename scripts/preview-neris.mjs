import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const server=await createServer({configFile:false,cacheDir:root+'/node_modules/.vite-neris',root:root+'/tests/fixtures',plugins:[react()],server:{host:'127.0.0.1',port:4187,strictPort:true,fs:{allow:[root]}}});
await server.listen();console.log('Fictional NERIS verification: http://127.0.0.1:4187/neris.html');
