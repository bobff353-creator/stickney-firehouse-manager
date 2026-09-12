'use client';
import { useCallback,useEffect,useRef,useState,useSyncExternalStore } from 'react';
import { getSupabaseBrowserClient } from './supabase-browser';
import { createApparatusLocationClient } from './apparatus-location-client';
import type { ApparatusLocation,LocationSnapshot } from './apparatus-location-domain';
import { createBrowserLocationSender } from './apparatus-location-sender';
import { respondingUnitsIncludeUnit } from './respond-device';
let shared:ReturnType<typeof createApparatusLocationClient>|undefined;
const empty={units:[] as ApparatusLocation[],connected:false,message:'Connecting to vehicle locations…',canManage:false,departmentId:'',userId:''};
function client(){
 if(!shared)shared=createApparatusLocationClient({
  now:Date.now,visible:()=>document.visibilityState==='visible',timer:(fn,ms)=>setTimeout(fn,ms),clear:id=>clearTimeout(id),
  async read(signal){const response=await fetch('/api/apparatus-locations',{cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(12000)])});if(!response.ok)throw Error(String(response.status));return await response.json() as LocationSnapshot;},
  connect(topic,update,status){
   const supabase=getSupabaseBrowserClient();
   const channel=supabase.channel(topic,{config:{private:true}}).on('broadcast',{event:'location'},message=>update(message.payload as ApparatusLocation)).subscribe(value=>status(value==='SUBSCRIBED'));
   return()=>{void supabase.removeChannel(channel);};
  },
 });return shared;
}
export function useApparatusLocations(alwaysOn=false,respondingUnits=''){
 const [senderStatus,setSenderStatus]=useState(''),[sending,setSending]=useState(false);
 const senderRef=useRef<ReturnType<typeof createBrowserLocationSender>|null>(null),respondingRef=useRef(respondingUnits);
 useEffect(()=>{respondingRef.current=respondingUnits;},[respondingUnits]);
 useEffect(()=>()=>senderRef.current?.stop(),[]);
 const subscribe=useCallback((fn:()=>void)=>client().subscribe(fn,alwaysOn),[alwaysOn]);
 const state=useSyncExternalStore(subscribe,()=>client().getSnapshot(),()=>empty);
 useEffect(()=>{
  const update=()=>client().visibility(),offline=()=>client().offline();document.addEventListener('visibilitychange',update);window.addEventListener('online',update);window.addEventListener('offline',offline);
  let previousUser=client().getSnapshot().userId;
  const {data:{subscription}}=getSupabaseBrowserClient().auth.onAuthStateChange((event,session)=>{const user=session?.user.id||'';if(event==='SIGNED_OUT'||(user&&previousUser&&user!==previousUser)){senderRef.current?.stop();setSending(false);client().reset();}if(user)previousUser=user;});
  return()=>{document.removeEventListener('visibilitychange',update);window.removeEventListener('online',update);window.removeEventListener('offline',offline);subscription.unsubscribe();};
 },[]);
 return {...state,refresh:()=>client().refresh(),sender:{status:senderStatus,active:sending,
  start(unit:string){senderRef.current?.stop();senderRef.current=createBrowserLocationSender(setSenderStatus,()=>Boolean(respondingRef.current)&&respondingUnitsIncludeUnit(respondingRef.current,unit),setSending);void senderRef.current.start().catch(()=>{senderRef.current?.stop();setSenderStatus('Location sharing could not start. Check browser location access.');});},
  stop(){senderRef.current?.stop();setSending(false);setSenderStatus('Sharing stopped. Other screens will show the last known location.');},
 }};
}
