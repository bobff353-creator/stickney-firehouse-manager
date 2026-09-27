import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { payrollDatabaseFixture } from '../tests/helpers/payroll-submission-db.mjs';

// Fictional, in-memory PostgreSQL only. No environment keys or live records.
const fixture=await payrollDatabaseFixture();
const server=await createServer({configFile:false,root:process.cwd(),plugins:[react(),{
  name:'fictional-payroll-api',configureServer(server){server.middlewares.use(async(req,res,next)=>{
    if(!req.url?.startsWith('/api/payroll-submissions')&&!req.url?.startsWith('/fixture/'))return next();
    try{
      let raw='';for await(const chunk of req)raw+=chunk;
      if(req.url==='/fixture/trade'){
        await fixture.pg.exec("INSERT INTO firehouse.time_entries VALUES('actual24','b','2026-09-11','2026-09-24','shift',6),('actual25','a','2026-09-11','2026-09-25','shift',6) ON CONFLICT DO NOTHING");
        res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true}));return;
      }
      if(req.url==='/fixture/mode'){
        const body=JSON.parse(raw);fixture.state.manager=body.manager!==false;fixture.state.loseResponse=Boolean(body.loseResponse);fixture.state.delayMs=Number(body.delayMs)||0;
        res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true}));return;
      }
      if(req.url==='/fixture/evidence'){
        const {rows}=await fixture.pg.query("SELECT (SELECT count(*) FROM firehouse.payroll_submissions)::int AS submissions,(SELECT count(*) FROM firehouse.payroll_adjustments)::int AS adjustments,(SELECT COALESCE(sum(delta_cents),0) FROM firehouse.payroll_adjustments)::int AS delta_cents");
        res.setHeader('Content-Type','application/json');res.end(JSON.stringify(rows[0]));return;
      }
      const url=`http://127.0.0.1:4199${req.url}`;
      const request=new Request(url,{method:req.method,headers:{origin:String(req.headers.origin||''),'content-type':'application/json','oai-authenticated-user-email':'admin@example.test'},...(req.method==='POST'?{body:raw}:{})});
      const response=await fixture.api[req.method==='POST'?'POST':'GET'](request);
      res.statusCode=response.status;for(const[k,v]of response.headers)res.setHeader(k,v);res.end(await response.text());
    }catch(error){res.statusCode=500;res.end(JSON.stringify({error:error.message}));}
  });}
}],server:{host:'127.0.0.1',port:4199,strictPort:true,watch:{ignored:['**/.next/**','**/outputs/**']}}});
await server.listen();
console.log('Fictional payroll workflow: http://127.0.0.1:4199/tests/fixtures/payroll-submission.html');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.close();await fixture.pg.close();process.exit(0);});
