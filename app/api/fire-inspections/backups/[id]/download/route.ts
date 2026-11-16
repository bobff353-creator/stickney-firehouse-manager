import {nativeBackupBoundary,nativeBackupContext,nativeBackupError} from '../../../../../fire-inspections/backup-runtime';
import {downloadNativeBackup} from '../../../../../fire-inspections/backup-service';
export const dynamic='force-dynamic';export const maxDuration=300;
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){const denied=await nativeBackupBoundary(request);if(denied)return denied;try{return await downloadNativeBackup(await nativeBackupContext(request),(await params).id);}catch(error){return nativeBackupError(error);}}
