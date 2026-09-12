// Local-only browser -> actual API/permissions/SQL -> PostgreSQL fixture.
// SSE replaces hosted Realtime transport; its authorization is tested separately.
import '../tests/helpers/location-route-loader.mjs';
import {locationRouteFixture} from '../tests/helpers/location-route-fixture.mjs';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';
const fixture=await locationRouteFixture(),sockets=new Set();let lastEvent=0,failed=false,denied=false;
await fixture.pg.exec("UPDATE firehouse.fleet_apparatus SET unit_number=CASE id WHEN 'test-engine' THEN 'TESTE' ELSE 'TESTC' END");
const tokens={};
for(const apparatusId of ['test-engine','test-car']){
 const response=await fixture.routes.POST(fixture.request(undefined,{action:'pair',apparatusId,deviceName:'Fictional preview device',senderKind:'windows'}));
 tokens[apparatusId]=(await response.json()).setup.token;
 await fixture.ingest.POST(fixture.request('/api/apparatus-locations/ingest',{latitude:41.8189+(apparatusId==='test-car'?.001:0),longitude:-87.7734,accuracy:9,measuredAt:new Date().toISOString(),moving:false},{authorization:'Bearer '+tokens[apparatusId]}));
}
await fixture.pg.exec("UPDATE firehouse.apparatus_trackers SET fix_at=clock_timestamp()-interval '10 minutes' WHERE apparatus_id='test-car'");
async function broadcast(){for(const row of (await fixture.pg.query('SELECT * FROM realtime.messages WHERE id>$1 ORDER BY id',[lastEvent])).rows){lastEvent=Number(row.id);for(const socket of sockets)if(socket.topic===row.topic)socket.response.write('data: '+JSON.stringify(row.payload)+'\n\n');}}
await broadcast();
const server=await createServer({configFile:false,root:process.cwd(),plugins:[react(),{name:'location-fixture',enforce:'pre',resolveId(source,importer){if(source==='./supabase-browser'&&importer?.includes('/app/'))return resolve('tests/fixtures/location-supabase.ts');},configureServer(server){server.middlewares.use(async(req,res,next)=>{
 const url=new URL(req.url,'http://127.0.0.1:4193');
 if(url.pathname==='/__location-events'){
  res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive'});res.write(': connected\n\n');const socket={topic:url.searchParams.get('topic'),response:res};sockets.add(socket);req.on('close',()=>sockets.delete(socket));return;
 }
 if(url.pathname==='/__location-control'){
  if(url.searchParams.has('resetSender')){const response=await fixture.routes.POST(fixture.request(undefined,{action:'pair',apparatusId:'test-engine',deviceName:'Fictional movement generator',senderKind:'windows'}));tokens['test-engine']=(await response.json()).setup.token;}
  if(url.searchParams.has('failed'))failed=url.searchParams.get('failed')==='1';
  if(url.searchParams.has('denied'))denied=url.searchParams.get('denied')==='1';
  if(url.searchParams.has('move')){await fixture.ingest.POST(fixture.request('/api/apparatus-locations/ingest',{latitude:41.8194,longitude:-87.774,accuracy:12,measuredAt:new Date().toISOString(),moving:true},{authorization:'Bearer '+tokens['test-engine']}));await broadcast();}
  res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({...fixture.counters,sockets:sockets.size}));
 }
 if(url.pathname==='/api/apparatus-locations'||url.pathname==='/api/apparatus-locations/ingest'){
  fixture.counters.requests++;
  if(failed||denied){res.statusCode=denied?403:503;res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({error:'Simulated failure'}));}
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const body=chunks.length?JSON.parse(Buffer.concat(chunks).toString()):undefined;
  const request=fixture.request(url.pathname,body,{cookie:req.headers.cookie||''});
  const result=url.pathname.endsWith('/ingest')?await fixture.ingest.POST(request):req.method==='POST'?await fixture.routes.POST(request):await fixture.routes.GET(request);
  res.statusCode=result.status;result.headers.forEach((value,key)=>res.setHeader(key,value));res.end(await result.text());await broadcast();return;
 }
 if(url.pathname.startsWith('/api/')){res.statusCode=404;return res.end('Missing fixture API');}next();
});}}],server:{host:'127.0.0.1',port:4193,strictPort:true,watch:{ignored:['**/.next/**','**/outputs/**']}}});
await server.listen();console.log('Isolated locations: http://127.0.0.1:4193/tests/fixtures/apparatus-locations.html');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{for(const socket of sockets)socket.response.end();await server.close();await fixture.pg.close();process.exit(0);});
