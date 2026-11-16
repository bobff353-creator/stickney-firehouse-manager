import {createPostgresD1Adapter} from '../../db/postgres-adapter';
import {getSupabaseServerClient} from '../supabase-server';
import {getPortalDepartment} from '../department-portal';
import {inspectionJson} from './server';
import {requireNativeInspectionAccess,NativeInspectionAccessError} from './access-context';
import {NativeBackupError,type NativeBackupContext,type BackupStorage} from './backup-service';

export function nativeBackupError(error:unknown){if(error instanceof NativeBackupError||error instanceof NativeInspectionAccessError)return inspectionJson({error:error.message,code:error.code},error.status);console.error('Native inspection backup failed',error instanceof Error?error.name:'Unknown failure');return inspectionJson({error:'This backup step could not finish. Your saved job and original inspections remain available. Resume the saved job.',code:'BACKUP_UNAVAILABLE'},503);}
export async function nativeBackupBoundary(request:Request,permission='backup.export'){try{await requireNativeInspectionAccess(request,permission);return null;}catch(error){return nativeBackupError(error);}}
export async function nativeBackupContext(request:Request):Promise<NativeBackupContext>{
 const department=await getPortalDepartment(),verified=request.headers.get('x-department-id'),actor=request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();if(!actor||!verified||verified!==department.id)throw new NativeBackupError('The verified department session is required.',403);
 const client=await getSupabaseServerClient();
 const storage:BackupStorage={
  async read(bucket,key){const {data,error}=await client.storage.from(bucket).download(key);if(error){if(/not found|does not exist|404/i.test(error.message))return null;throw error;}return data;},
  async write(bucket,key,bytes,contentType){const {error}=await client.storage.from(bucket).upload(key,bytes,{contentType:contentType??'application/octet-stream',upsert:false});if(error&&!/already exists|duplicate|409/i.test(error.message))throw error;},
  async list(bucket,path,offset){const {data,error}=await client.storage.from(bucket).list(path,{limit:100,offset,sortBy:{column:'name',order:'asc'}});if(error)throw error;return(data??[]).map(item=>({name:item.name,folder:!item.id,updatedAt:item.updated_at??undefined,size:item.metadata?.size as number|undefined,contentType:item.metadata?.mimetype as string|undefined}));},
  async info(bucket,key){const {data,error}=await client.storage.from(bucket).info(key);if(error){if(/not found|does not exist|404/i.test(error.message))return null;throw error;}return data?{size:Number(data.size),updatedAt:data.lastModified,contentType:data.contentType}:null;},
 };
 // No bootstrap, seed, migration, or unrelated operational write is run here.
 return{department:verified,actor,isolated:department.isolated,db:createPostgresD1Adapter(),storage};
}
export async function nativeBackupBody(request:Request,max=MAX_JSON){const bytes=await nativeBackupBytes(request,max);let value:unknown;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new NativeBackupError('The request contains unreadable JSON.');}if(!value||typeof value!=='object'||Array.isArray(value))throw new NativeBackupError('A JSON object is required.');return value as Record<string,unknown>;}
const MAX_JSON=3*1024*1024+65536;
export async function nativeBackupBytes(request:Request,max:number){const length=Number(request.headers.get('content-length')??0);if(length>max)throw new NativeBackupError('This backup part exceeds its supported size.',413);const reader=request.body?.getReader();if(!reader)throw new NativeBackupError('Choose the original backup file.');const chunks:Uint8Array[]=[];let size=0;try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>max){await reader.cancel();throw new NativeBackupError('This backup part exceeds its supported size.',413);}chunks.push(next.value);}}finally{reader.releaseLock();}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;}
