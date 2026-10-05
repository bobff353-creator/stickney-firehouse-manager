import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],resolve:{alias:{'next/image':new URL('./next-image-stub.tsx',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1')}},optimizeDeps:{entries:['tests/fixtures/phase-four-preview.html']},server:{host:'127.0.0.1',port:5187,watch:{ignored:['**/.next/**']}}});
