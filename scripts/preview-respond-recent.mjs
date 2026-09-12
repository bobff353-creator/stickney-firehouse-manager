import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { PGlite } from '@electric-sql/pglite';
import { recentCallRows, seedRecentCalls } from '../tests/helpers/recent-call-data.mjs';

const pg = new PGlite();
await seedRecentCalls(pg);
const server = await createServer({configFile:false,root:process.cwd(),plugins:[react(),{
  name:'isolated-recent-calls',configureServer(server){server.middlewares.use(async(req,res,next)=>{
    const url = new URL(req.url,'http://127.0.0.1:4194');
    if(url.pathname==='/__recent-calls'){
      const calls = await recentCallRows(pg);
      res.setHeader('Content-Type','application/json');
      // Fictional, distinct saved locations enable testing map selection and return.
      return res.end(JSON.stringify(calls.map((call,i)=>({...call,latitude:41.8189+i*.001,longitude:-87.7734,locationSource:'Fictional preview location'}))));
    }
    if(url.pathname.startsWith('/api/')){
      res.setHeader('Content-Type','application/json');
      if(url.pathname!=='/api/maps-config')res.statusCode=404;
      return res.end(JSON.stringify({configured:false}));
    }
    next();
  });}
}],server:{host:'127.0.0.1',port:4194,strictPort:true,watch:{ignored:['**/.next/**','**/outputs/**']}}});
await server.listen();
console.log('Isolated recent calls: http://127.0.0.1:4194/tests/fixtures/respond-recent.html');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.close();await pg.close();process.exit(0);});
