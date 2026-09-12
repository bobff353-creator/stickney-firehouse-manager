import { metresBetween,shouldSendLocation,type LocationFix } from './apparatus-location-domain';
// One sender per browser origin. A paired browser's credential is HttpOnly;
// JavaScript never reads or stores the device secret.
export function createBrowserLocationSender(report:(text:string)=>void,responding:()=>boolean,active:(running:boolean)=>void=()=>{}){
 let stopped=true,watch:number|undefined,timer:ReturnType<typeof setInterval>|undefined,release:(()=>void)|undefined;
 let last:LocationFix|null=null,lastSent=0,latest:LocationFix|null=null,inFlight=false,refreshing=false,nextAttempt=0;
 let controller:AbortController|null=null;
 function position(value:GeolocationPosition){
  if(stopped)return;
  const point={latitude:value.coords.latitude,longitude:value.coords.longitude,accuracy:value.coords.accuracy};
  const moved=last?metresBetween(last,point)>Math.max(20,Math.min(last.accuracy,point.accuracy)):false;
  latest={...point,measuredAt:new Date(value.timestamp).toISOString(),moving:(value.coords.speed??0)>=1.5||moved};
  if(point.accuracy>75)report(`Location accuracy ±${Math.round(point.accuracy)} m is too low. Waiting for a better fix.`);
 }
 function problem(error:GeolocationPositionError){if(stopped)return;report(error.code===1?'Location permission denied. Allow location for this site in browser settings.':'No fresh location fix. Last known position is retained.');}
 async function tick(){
  if(stopped||inFlight||Date.now()<nextAttempt)return;
  if(document.visibilityState!=='visible'){report('Browser tracking paused while this page is hidden. Use the Windows companion for background tracking.');return;}
  if(!latest||Date.now()-Date.parse(latest.measuredAt)>20000){
   if(!refreshing){refreshing=true;navigator.geolocation.getCurrentPosition(value=>{refreshing=false;if(!stopped)position(value);},error=>{refreshing=false;nextAttempt=Date.now()+15000;if(!stopped)problem(error);},{enableHighAccuracy:true,maximumAge:0,timeout:12000});}return;
  }
  if(!shouldSendLocation(latest,last,lastSent,responding()))return;
  const fix=latest;inFlight=true;controller=new AbortController();
  try{
   const response=await fetch('/api/apparatus-locations/ingest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(fix),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});
   if(stopped)return;
   const result=await response.json();
   if(response.status===401){stop();report('This device pairing expired or was revoked. Ask an administrator to pair it again.');return;}
   if(response.ok&&result.accepted){last=fix;lastSent=Date.now();nextAttempt=0;report(`Sharing this vehicle’s location · accuracy ±${Math.round(fix.accuracy)} m`);}
   else {nextAttempt=Date.now()+(response.status===429?5000:15000);report('Location was not saved. Keeping the last confirmed position.');}
  }catch{if(!stopped){nextAttempt=Date.now()+15000;report('Connection interrupted. Location will retry; old fixes are not replayed.');}}
  finally{inFlight=false;controller=null;}
 }
 async function start(){
  if(!stopped)return;
  if(!navigator.geolocation){report('This browser does not provide location.');return;}
  if(!navigator.locks){report('Use current Edge/Chrome or the Windows companion to prevent duplicate senders.');return;}
  stopped=false;report('Requesting this vehicle’s location…');
  await navigator.locks.request('stickney-apparatus-location-sender',{ifAvailable:true},async lock=>{
   if(stopped)return;
   if(!lock){stopped=true;active(false);report('Another tab is already sending from this browser.');return;}
   active(true);
   watch=navigator.geolocation.watchPosition(position,problem,{enableHighAccuracy:true,maximumAge:0,timeout:12000});
   timer=setInterval(()=>void tick(),1000);await new Promise<void>(resolve=>{release=resolve;});
  });
 }
 function stop(){stopped=true;active(false);if(watch!==undefined)navigator.geolocation.clearWatch(watch);if(timer)clearInterval(timer);controller?.abort();release?.();release=undefined;watch=undefined;timer=undefined;latest=null;last=null;lastSent=0;}
 return {start,stop};
}
