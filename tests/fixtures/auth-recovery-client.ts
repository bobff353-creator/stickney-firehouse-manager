export const audit={identity:'outage',context:200,signouts:0,errors:[] as string[]};
Object.assign(window,{authRecovery:audit});
let listener: ((event:string,session:unknown)=>void)|null=null;
export function getSupabaseBrowserClient(){return{auth:{
  getUser:async()=>audit.identity==='outage'?{data:{user:null},error:{status:503}}:audit.identity==='expired'?{data:{user:null},error:{status:401}}:{data:{user:{id:'fictional-member',email:'fixture@example.invalid'}},error:null},
  onAuthStateChange(callback:typeof listener){listener=callback;return{data:{subscription:{unsubscribe(){listener=null;}}}};},
  async signOut(){audit.signouts++;listener?.('SIGNED_OUT',null);return{};},
}};}
