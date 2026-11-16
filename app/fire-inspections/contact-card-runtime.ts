import {inspectionJson} from './server';
import {requireNativeInspectionAccess,NativeInspectionAccessError} from './access-context';
import {nativeBackupContext} from './backup-runtime';
import {ContactCardError} from './contact-card-service';
export function contactCardFailure(error:unknown){if(error instanceof ContactCardError||error instanceof NativeInspectionAccessError)return inspectionJson({error:error.message,code:error.code},error.status);return inspectionJson({error:'This business card could not be confirmed. Keep the original image and retry the same selected file.',code:'CONTACT_CARD_UNCONFIRMED'},503);}
export async function nativeContactCardContext(request:Request,permission:string){const access=await requireNativeInspectionAccess(request,permission),backend=await nativeBackupContext(request);return {...access,storage:backend.storage};}
