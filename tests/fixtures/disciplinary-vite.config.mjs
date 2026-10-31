import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {readFileSync} from 'node:fs';
export default defineConfig({plugins:[{name:'preview-existing-css',enforce:'pre',load(id){if(id.replaceAll('\\','/').endsWith('/app/globals.css'))return readFileSync(id,'utf8').replace('@import "tailwindcss";','');}},react()],css:{postcss:{plugins:[]}},optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','react/jsx-runtime']},server:{host:'127.0.0.1',port:5199,strictPort:true,watch:{ignored:['**/.next/**']}}});
