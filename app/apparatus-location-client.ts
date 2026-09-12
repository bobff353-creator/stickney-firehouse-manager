import { mergeLocation,type ApparatusLocation,type LocationSnapshot } from './apparatus-location-domain';
type Dependencies={
 now:()=>number; read:(signal:AbortSignal)=>Promise<LocationSnapshot>;
 connect:(topic:string,update:(unit:ApparatusLocation)=>void,status:(connected:boolean)=>void)=>()=>void;
 timer:(fn:()=>void,delay:number)=>ReturnType<typeof setTimeout>; clear:(id:ReturnType<typeof setTimeout>)=>void;
 visible:()=>boolean;
};
export type LocationView={units:ApparatusLocation[];connected:boolean;message:string;canManage:boolean;departmentId:string;userId:string};
export function createApparatusLocationClient(deps:Dependencies){
 let state:LocationView={units:[],connected:false,message:'Connecting to vehicle locations…',canManage:false,departmentId:'',userId:''};
 const listeners=new Map<()=>void,boolean>();let timeout:ReturnType<typeof setTimeout>|undefined,controller:AbortController|null=null,disconnect:(()=>void)|null=null;
 let topic='',expires=0,generation=0,failures=0,catchup=false,catchupScheduled=false;
 const emit=(patch:Partial<LocationView>)=>{state={...state,...patch};listeners.forEach((_,listener)=>listener());};
 const active=()=>listeners.size>0&&(deps.visible()||[...listeners.values()].some(Boolean));
 function schedule(delay:number){if(timeout)deps.clear(timeout);if(active())timeout=deps.timer(()=>void refresh(),Math.max(1000,delay));}
 function leave(){disconnect?.();disconnect=null;topic='';expires=0;}
 async function refresh(){
  if(!active()||controller)return;
  catchupScheduled=false;
  if(expires&&deps.now()>=expires)emit({connected:false});
  const own=++generation,started=deps.now();controller=new AbortController();
  try{
   const data=await deps.read(controller.signal);if(own!==generation||!active())return;
   if(!data.departmentId||!data.userId||!Array.isArray(data.units)||data.units.length>100||!Number.isFinite(Date.parse(data.expiresAt)))throw Error('Invalid location response');
   const remaining=Date.parse(data.expiresAt)-Date.parse(data.serverTime)-(deps.now()-started);
   if(!(remaining>0&&remaining<=61000))throw Error('Location viewing lease expired');
   const changedIdentity=state.departmentId!==data.departmentId||state.userId!==data.userId;
   if(changedIdentity)leave();
   expires=deps.now()+remaining;failures=0;
   const units=changedIdentity?data.units:data.units.map(unit=>{const previous=state.units.find(item=>item.apparatusId===unit.apparatusId);return previous&&previous.sequence>unit.sequence?previous:unit;});
   emit({units,canManage:data.canManage,departmentId:data.departmentId,userId:data.userId,message:'',...(changedIdentity?{connected:false}:{})});
   if(topic!==data.topic){
    disconnect?.();topic=data.topic;catchup=false;
    emit({connected:false});
    const subscribedTopic=topic;
    disconnect=deps.connect(topic,unit=>{
     if(topic!==subscribedTopic||deps.now()>=expires||!active())return;
     if(!unit||typeof unit.apparatusId!=='string'||!Number.isFinite(unit.sequence))return;
     emit({units:mergeLocation(state.units,unit)});
    },connected=>{
     if(topic!==subscribedTopic)return;
     emit({connected:connected&&deps.now()<expires,message:connected?'':'Location connection interrupted; showing last known positions.'});
     // Join before a catch-up snapshot so movement between the initial read and
     // subscription cannot be lost. No new source/location request is made.
     if(connected&&!catchup){catchup=true;catchupScheduled=true;schedule(1000);}
     if(!connected){catchup=false;schedule(15000);}
    });
   }
   schedule(catchupScheduled?1000:remaining+50);
  }catch(error){
   if(own!==generation)return;
   const denied=error instanceof Error&&['401','403','423'].includes(error.message);
   leave();failures++;
   emit({connected:false,canManage:false,message:denied?'Unlock the portal with an authorized account to view locations.':'Location connection interrupted; showing last known positions.',...(denied?{units:[],departmentId:'',userId:''}:{})});
   schedule(Math.min(60000,5000*2**Math.min(failures,4)));
  }finally{if(own===generation)controller=null;}
 }
 function suspend(){generation++;controller?.abort();controller=null;if(timeout)deps.clear(timeout);timeout=undefined;leave();emit({connected:false});}
 return {
  getSnapshot:()=>state,
  subscribe(listener:()=>void,alwaysOn=false){listeners.set(listener,alwaysOn);if(listeners.size===1)void refresh();return()=>{listeners.delete(listener);if(!listeners.size){suspend();state={units:[],connected:false,message:'Connecting to vehicle locations…',canManage:false,departmentId:'',userId:''};}};},
  refresh:()=>refresh(),
  visibility(){if(active())void refresh();else suspend();},
  offline(){suspend();emit({message:'Offline; showing last known positions.'});},
  reset(){suspend();emit({units:[],canManage:false,departmentId:'',userId:''});if(active())void refresh();},
 };
}
