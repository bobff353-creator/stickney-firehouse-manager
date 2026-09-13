// Isolated browser -> HTTP -> real PostgreSQL cache -> actual board components.
// No production secrets, data, mutations, or external feed requests.
import '../tests/helpers/feed-test-loader.mjs';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { boardLinksHarness, store as linkStore } from '../tests/helpers/board-links-harness.mjs';
const links = await boardLinksHarness();
const { createFeedReader } = await import('../app/lib/board-feed-reader.ts');
const { feedGroups, nextFeedSlot } = await import('../app/lib/feed-schedule.ts');
const pg = new PGlite();
await pg.exec('CREATE SCHEMA firehouse; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
await pg.exec(await readFile(new URL('../supabase/migrations/20260912104034_shared_board_feed_cache.sql',import.meta.url),'utf8'));
const now = Date.now(), today = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago'}).format(now), tomorrow = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago'}).format(now+86400000);
const courseDay = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago'}).format(now+7*86400000);
const payloads = {
 weather: { location:'Berwyn, IL',days:[today,tomorrow].map(date=>({date,condition:'Fixture clear weather',high:72,low:60,precipitationChance:10,windGust:8})),hours:Array.from({length:4},(_,i)=>({time:new Date(now+(i+1)*3600000).toISOString(),condition:'Fixture clear',temperature:72,precipitationChance:10,windSpeed:8})),detailUrl:'https://weather.com/us/illinois/city/berwyn/today' },
 close_calls:{items:[{title:'Fictional report for layout verification',url:'https://www.firefighterclosecalls.com/',publishedAt:new Date(now).toISOString(),excerpt:'Local test data only. This is not an incident report.'}]},
 usfa:{year:new Date().getFullYear(),total:0,items:[],source:'Fixture USFA payload'},
 ...Object.fromEntries(['romeoville','ifsi','nipsta'].map(id=>['training_'+id,{id,checkedAt:new Date(now-120000).toISOString(),available:true,resources:[],upcoming:[{title:'Fictional training class — local test',url:'https://example.invalid/',startDate:courseDay,endDate:courseDay,location:'Preview only',detail:'Not an actual class'}]}])),
};
for(const [source,payload] of Object.entries(payloads)) await pg.query('INSERT INTO firehouse.board_feed_cache(source,payload,last_success_at,last_attempt_at,attempted_slot,next_scheduled_at,status) VALUES($1,$2,$3,$3,$4,$5,$6)',[source,JSON.stringify(payload),new Date(now-120000).toISOString(),new Date(Math.floor(now/900000)*900000).toISOString(),new Date(nextFeedSlot(source,now)).toISOString(),'ok']);
let databaseReads=0;
const read=createFeedReader(async sources=>{databaseReads++;return (await pg.query('SELECT * FROM firehouse.board_feed_cache WHERE source=ANY($1)',[sources])).rows;});
const server=await createServer({configFile:false,root:process.cwd(),plugins:[react(),{name:'isolated-board-cache',configureServer(server){server.middlewares.use(async(req,res,next)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/board-links'){
  let raw=''; for await(const chunk of req) raw+=chunk;
  const role=String(req.headers['x-fixture-role']||'admin');
  const request=new Request('http://localhost/api/board-links',{method:req.method,headers:{'x-fixture-role':role,'oai-authenticated-user-email':role+'@example.invalid'},...(raw?{body:raw}:{})});
  const handler=links.api[req.method];if(!handler){res.statusCode=405;return res.end();}
  const response=await handler(request);res.statusCode=response.status;response.headers.forEach((value,key)=>res.setHeader(key,value));return res.end(await response.text());
 }
 if(url.pathname==='/__links-state') {res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({settings:await linkStore.readBoardLinks(links.db),canEdit:true,confirmed:true,checkedAt:new Date().toISOString()}));}
 if(url.pathname==='/__links-fail-next') {links.stats.failNext=true;return res.end('armed');}
 if(url.pathname==='/__links-stats') {res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(links.stats));}
 if(url.pathname==='/api/board-feeds'){
  const group=url.searchParams.get('group');if(!feedGroups[group]){res.statusCode=400;return res.end();}
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');return res.end(JSON.stringify(await read(feedGroups[group])));
 }
 if(url.pathname==='/__feed-audit'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({databaseReads,externalRequests:0}));}
 if(url.pathname.startsWith('/api/')){res.statusCode=404;return res.end('Fixture route missing');}next();
});}}],server:{host:'127.0.0.1',port:4192,strictPort:true,watch:{ignored:['**/.next/**','**/outputs/**']}}});
await server.listen();console.log('Isolated board verification: http://127.0.0.1:4192/tests/fixtures/board-feeds-audit.html');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.close();await pg.close();await links.close();process.exit(0);});
