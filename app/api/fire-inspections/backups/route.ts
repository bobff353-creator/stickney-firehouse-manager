import {inspectionJson} from '../../../fire-inspections/server';
import {nativeBackupBoundary,nativeBackupBody,nativeBackupContext,nativeBackupError} from '../../../fire-inspections/backup-runtime';
import {createNativeBackup,createNativeRestore,listNativeBackups,nativeBackupDispatchHolds,NativeBackupError} from '../../../fire-inspections/backup-service';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request:Request){const denied=await nativeBackupBoundary(request);if(denied)return denied;try{const c=await nativeBackupContext(request);return inspectionJson({jobs:await listNativeBackups(c),dispatchHolds:await nativeBackupDispatchHolds(c)});}catch(error){return nativeBackupError(error);}}
export async function POST(request:Request){const denied=await nativeBackupBoundary(request);if(denied)return denied;try{const c=await nativeBackupContext(request),body=await nativeBackupBody(request);if(body.action==='create')return inspectionJson({job:await createNativeBackup(c)},201);if(body.action==='restore')return inspectionJson({job:await createNativeRestore(c,body.manifest)},201);throw new NativeBackupError('Choose full backup or staged recovery.');}catch(error){return nativeBackupError(error);}}
