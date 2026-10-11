import { inspectionPilotAccess } from './access';

export const inspectionRetentionMs = 7 * 86400000;
const databaseName = 'firehouse-private-inspection-recovery-v1';
const logoutEvent = 'firehouse:inspection-recovery-cleared';
type Stored = { id: string; key?: CryptoKey; iv?: Uint8Array; cipher?: ArrayBuffer; expires?: number; revision?: number };
const active = new Set<InspectionVault>();
let generation=0;
function database(): Promise<IDBDatabase> {
  return new Promise((resolve,reject) => {
    const r=indexedDB.open(databaseName,1);
    r.onupgradeneeded=()=>r.result.createObjectStore('entries',{keyPath:'id'});
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
}
function request<T>(r: IDBRequest<T>): Promise<T> { return new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}); }
function complete(tx: IDBTransaction): Promise<void> { return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Browser recovery transaction was interrupted.'));}); }
export class InspectionVault {
  private revisions = new Map<string,number>();
  private tail: Promise<unknown> = Promise.resolve();
  private closed = false;
  constructor(private db: IDBDatabase,private scope: string,private key: CryptoKey) { active.add(this); }
  close(){this.closed=true;this.db.close();active.delete(this);}
  private assertOpen(){if(this.closed)throw Error('Inspection recovery was locked or cleared. Sign in again.');}
  private serial<T>(work:()=>Promise<T>):Promise<T>{const next=this.tail.then(()=>{this.assertOpen();return work();});this.tail=next.catch(()=>undefined);return next;}
  async list<T>(prefix:string):Promise<{id:string;value:T}[]> {
    return this.serial(async()=>{
      const rows=await request<Stored[]>(this.db.transaction('entries').objectStore('entries').getAll());const result=[];
      for(const row of rows.filter(r=>r.id.startsWith(this.scope+':'+prefix))){
        this.assertOpen();const id=row.id.slice(this.scope.length+1);this.revisions.set(id,row.revision||0);
        if(!row.expires||row.expires<=Date.now()){await this.deleteEntry(id);continue;}
        try {const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:row.iv as Uint8Array<ArrayBuffer>,additionalData:new TextEncoder().encode(row.id)},this.key,row.cipher!);result.push({id,value:JSON.parse(new TextDecoder().decode(bytes)) as T});}
        catch {throw Error('A browser recovery entry could not be decrypted. Keep any open draft and clear browser recovery before retrying.');}
      }
      return result;
    });
  }
  write(id:string,value:unknown):Promise<void>{return this.serial(async()=>{
    const fullId=this.scope+':'+id,iv=crypto.getRandomValues(new Uint8Array(12)),cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(fullId)},this.key,new TextEncoder().encode(JSON.stringify(value)));
    this.assertOpen();const tx=this.db.transaction('entries','readwrite'),done=complete(tx),store=tx.objectStore('entries');
    const current=await request<Stored|undefined>(store.get(fullId));
    if((current?.revision||0)!==(this.revisions.get(id)||0)){tx.abort();await done.catch(()=>undefined);throw Error('Another tab changed this browser draft. Download your draft and reopen the latest recovery; it was not overwritten.');}
    const revision=(current?.revision||0)+1;store.put({id:fullId,iv,cipher,expires:Date.now()+inspectionRetentionMs,revision});await done;this.revisions.set(id,revision);
  });}
  private async deleteEntry(id:string){this.assertOpen();const tx=this.db.transaction('entries','readwrite'),done=complete(tx),store=tx.objectStore('entries');const current=await request<Stored|undefined>(store.get(this.scope+':'+id));if((current?.revision||0)!==(this.revisions.get(id)||0)){tx.abort();await done.catch(()=>undefined);throw Error('Another tab changed this recovery entry. It was not discarded. Reopen the latest recovery.');}store.delete(this.scope+':'+id);await done;this.revisions.set(id,0);}
  remove(id:string):Promise<void>{return this.serial(()=>this.deleteEntry(id));}
}
export async function openInspectionVault(department:string,email:string):Promise<InspectionVault>{
  const openingGeneration=generation;
  if(!department||!inspectionPilotAccess(email))throw Error('Verified inspection access is required for browser recovery.');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([department,email.trim().toLowerCase()])));
  const scope=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
  const db=await database(),generated=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const tx=db.transaction('entries','readwrite'),done=complete(tx),store=tx.objectStore('entries'),id=scope+':key';
  const current=await request<Stored|undefined>(store.get(id)),key=current?.key||generated;if(!current)store.put({id,key});await done;
  if(openingGeneration!==generation){db.close();throw Error('Recovery was cleared while opening. Sign in again.');}
  return new InspectionVault(db,scope,key);
}
export async function clearInspectionRecovery():Promise<void>{
  generation++;
  for(const vault of [...active])vault.close();
  if(typeof window==='undefined')return;
  try{localStorage.setItem(logoutEvent,String(Date.now()));}catch{/* Auth sign-out still runs when browser storage is blocked. */}
  try{for(let i=sessionStorage.length-1;i>=0;i--){const key=sessionStorage.key(i)!;if(key.startsWith('firehouse:private-inspection-draft:')||key.startsWith('firehouse:inspection-field-queue:'))sessionStorage.removeItem(key);}}catch{/* Continue clearing the encrypted store. */}
  const db=await database();try{const tx=db.transaction('entries','readwrite'),done=complete(tx);tx.objectStore('entries').clear();await done;}finally{db.close();}
}
if(typeof window!=='undefined')window.addEventListener('storage',event=>{if(event.key===logoutEvent){generation++;for(const vault of [...active])vault.close();}});
