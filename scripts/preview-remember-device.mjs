import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const fixture=fileURLToPath(new URL('../tests/fixtures/remember-device-session.tsx',import.meta.url));
const server=await createServer({configFile:false,root:`${root}/tests/fixtures`,publicDir:`${root}/public`,plugins:[{
  name:'local-auth-adapter',enforce:'pre',resolveId(source,importer){
    if(source==='./supabase-browser'&&/app\/(auth-gateway|session-idle-lock)\.tsx$/.test(importer?.replaceAll('\\','/')||''))return fixture;
    if(source==='./payroll-app'&&importer?.replaceAll('\\','/').endsWith('/app/auth-gateway.tsx'))return fixture;
  },
},react()],server:{host:'127.0.0.1',port:4183,strictPort:true,fs:{allow:[root]}}});
await server.listen();console.log('Fictional sign-in test: http://127.0.0.1:4183/remember-device.html');
