// Actual UI + route + store + SQL adapter; fictional provider data, isolated DB.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { trainingHarness } from '../tests/helpers/training-harness.mjs';
const h=await trainingHarness();
const { assembleFeeds }=h.load('app/lib/board-feed-reader.ts');
const { feedGroups }=h.load('app/lib/feed-schedule.ts');
const linksApi=h.load('app/api/board-links/route.ts');
const { readBoardLinks,saveBoardLinks }=h.load('app/board-links-store.ts');
const { defaultBoardLinks }=h.load('app/board-links.ts');
await saveBoardLinks(h.db,'romeoville',{...defaultBoardLinks().sections.romeoville,links:[{id:'existing',label:'Previously saved department link',url:'https://www.romeoville.org/562/Fire-Rescue-Courses',note:'Must be preserved'}]},'','fixture admin');
const server=await createServer({configFile:false,root:process.cwd(),plugins:[react(),{name:'isolated-training',configureServer(server){server.middlewares.use(async(req,res,next)=>{
  const url=new URL(req.url,'http://localhost');
  const json=value=>{res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(value));};
  if(url.pathname==='/__links-state')return json({settings:await readBoardLinks(h.db),canEdit:true,confirmed:true,checkedAt:new Date().toISOString()});
  if(url.pathname==='/__training-reset'){await h.pg.query("DELETE FROM firehouse.system_meta WHERE key LIKE 'training-preview:%'");await h.pg.query('DELETE FROM firehouse.board_feed_cache');return json({reset:true});}
  if(url.pathname==='/__training-fail-save'){h.stats.failBatchAt=2;return json({armed:true});}
  if(url.pathname==='/__training-stats')return json(h.stats);
  if(url.pathname==='/api/board-feeds'){const sources=feedGroups[url.searchParams.get('group')];return json(assembleFeeds(sources,(await h.pg.query('SELECT * FROM firehouse.board_feed_cache')).rows));}
  if(['/api/training-import','/api/board-links'].includes(url.pathname)){
    let raw='';for await(const part of req)raw+=part;
    const request=new Request('http://localhost'+url.pathname,{method:req.method,headers:{'content-type':'application/json','x-fixture-role':String(req.headers['x-fixture-role']||'admin'),'oai-authenticated-user-email':'fixture@example.invalid'},...(raw?{body:raw}:{})});
    const api=url.pathname==='/api/training-import'?h.api:linksApi;
    const response=await api[req.method](request);res.statusCode=response.status;response.headers.forEach((v,k)=>res.setHeader(k,v));return res.end(await response.text());
  }
  next();
});}}],server:{host:'127.0.0.1',port:4193,strictPort:true,watch:{ignored:['**/.next/**','**/outputs/**']}}});
await server.listen();console.log('Local training verification: http://127.0.0.1:4193/tests/fixtures/board-feeds-audit.html?links&training');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.close();await h.close();process.exit(0);});
