import {inspectionJson} from './server';
import {InspectionCaseError} from './case-service';
import {NativeBackupError} from './backup-service';
import {NativeInspectionAccessError,requireNativeInspectionAccess} from './access-context';
import {nativeBackupContext} from './backup-runtime';
import {nativeCaseContext} from './case-service';
export async function nativeCaseAccess(request:Request,permission='records.read'){const access=await requireNativeInspectionAccess(request,permission);return nativeCaseContext(await nativeBackupContext(request),access);}
export function nativeCaseError(error:unknown){if(error instanceof InspectionCaseError||error instanceof NativeBackupError||error instanceof NativeInspectionAccessError)return inspectionJson({error:error.message,code:error.code},error.status);const message=error instanceof Error?error.message:'';if(!/Portal database|Portal transaction|fetch|storage/i.test(message)&&message&&!message.includes('\n'))return inspectionJson({error:message,code:'CASE_REVIEW'},400);console.error('Inspection case action failed',error instanceof Error?error.name:'Unknown failure');return inspectionJson({error:'This case action was not confirmed. Keep your draft and retry the same review request.',code:'CASE_UNCONFIRMED'},503);}
