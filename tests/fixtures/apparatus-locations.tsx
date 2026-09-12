import React from 'react';
import {createRoot} from 'react-dom/client';
import Respond from '../../app/respond';
import '../../app/globals.css';
import '../../app/mobile-usability.css';
import '../../app/portal-usability.css';
const params=new URLSearchParams(location.search);
const audit={requests:[] as string[],errors:[] as string[],incoming:false,accuracy:9,gpsReads:0,holdLocations:false};
Object.assign(window,{locationAudit:audit});
window.addEventListener('error',event=>audit.errors.push(event.error?.stack||event.message));window.addEventListener('unhandledrejection',event=>audit.errors.push(String(event.reason)));
Object.defineProperty(navigator,'geolocation',{value:{
 watchPosition(success:(position:unknown)=>void){return window.setInterval(()=>{audit.gpsReads++;success({coords:{latitude:41.8189,longitude:-87.7734,accuracy:audit.accuracy,speed:0},timestamp:Date.now()});},1000);},clearWatch(id:number){window.clearInterval(id);},
 getCurrentPosition(success:(position:unknown)=>void){audit.gpsReads++;success({coords:{latitude:41.8189,longitude:-87.7734,accuracy:audit.accuracy,speed:0},timestamp:Date.now()});}
}});
const nativeFetch=window.fetch.bind(window);
window.fetch=async(input,init)=>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href);
 if(url.origin!==location.origin)throw Error('External request blocked in local verification');audit.requests.push(url.pathname+url.search);
 if(url.pathname.startsWith('/api/apparatus-locations')){if(audit.holdLocations)await new Promise((_,reject)=>init?.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));return nativeFetch(input,init);}
 if(url.pathname.startsWith('/__'))return nativeFetch(input,init);
 if(url.pathname==='/api/maps-config')return Response.json({configured:false});
 if(url.pathname==='/api/respond')return Response.json({departmentId:'14a76771-4c24-481b-8def-e6cce005c17b',activeCall:audit.incoming?{reportNumber:'FICTIONAL-CALL',callType:'SIMULATED CALL',category:'Fire',address:'LOCAL VERIFICATION ONLY',city:'Stickney',narrative:'Fictional incident for browser verification. No dispatch sent.',respondingUnits:'TESTE',longitude:null,latitude:null,dispatchedAt:new Date().toISOString(),timeOut:'1200',source:'Fixture',receivedAt:new Date().toISOString()}:null,preplan:null,match:null,cadUpdates:[],apparatusFilter:url.searchParams.get('apparatus'),generatedAt:new Date().toISOString(),recentCalls:[],boxCard:null,nearestHydrants:[],operational:null,overview:{apparatus:null,preplans:[],hydrants:[],roadClosures:[]}});
 throw Error('Unexpected fixture API '+url.pathname);
};
createRoot(document.getElementById('root')!).render(<><p style={{margin:0,background:'#fff7d6',padding:8,color:'#442e00'}}>LOCAL VERIFICATION — fictional vehicles, simulated GPS, no production records. Basemap intentionally disconnected.</p>{Array.from({length:params.has('four')?4:1},(_,index)=><main key={index}><section className="workspace"><Respond apparatus={params.has('four')?'TESTE':''}/></section></main>)}</>);
