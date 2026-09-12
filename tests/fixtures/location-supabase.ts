// This file is aliased only by the isolated Vite verification script.
export function getSupabaseBrowserClient(){return {
 channel(topic:string){let stream:EventSource|null=null,update:(value:{payload:unknown})=>void=()=>{};
  const channel={on(_type:string,_filter:unknown,callback:typeof update){update=callback;return channel;},subscribe(status:(state:string)=>void){stream=new EventSource('/__location-events?topic='+encodeURIComponent(topic));stream.onopen=()=>status('SUBSCRIBED');stream.onmessage=event=>update({payload:JSON.parse(event.data)});stream.onerror=()=>status('CHANNEL_ERROR');return channel;},close(){stream?.close();}};return channel;
 },removeChannel(channel:{close:()=>void}){channel.close();return Promise.resolve();},auth:{onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};}}
};}
