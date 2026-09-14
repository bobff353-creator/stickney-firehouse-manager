import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const server=await createServer({configFile:false,cacheDir:root+'/node_modules/.vite-auth-recovery',root:root+'/tests/fixtures',publicDir:root+'/public',plugins:[{
 name:'fictional-auth-boundary',enforce:'pre',resolveId(source,importer){
  if(!importer?.replaceAll('\\','/').endsWith('/app/auth-gateway.tsx'))return null;
  if(source==='./supabase-browser')return root+'/tests/fixtures/auth-recovery-client.ts';
  if(['./payroll-app','./session-idle-lock'].includes(source))return root+'/tests/fixtures/auth-recovery-protected.tsx';
 },
},react()],server:{host:'127.0.0.1',port:4182,strictPort:true,fs:{allow:[root]}}});
await server.listen();console.log('Fictional authentication boundary: http://127.0.0.1:4182/auth-recovery.html');
