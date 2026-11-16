import {inspectionJson} from '../../../../fire-inspections/server';
import {nativeBackupBody} from '../../../../fire-inspections/backup-runtime';
import {nativeCaseAction} from '../../../../fire-inspections/case-service';
import {nativeCaseError,nativeCaseAccess} from '../../../../fire-inspections/case-runtime';
export const dynamic='force-dynamic';export const maxDuration=60;
export async function POST(request:Request){try{const input=await nativeBackupBody(request,64000),permission=input.action==='addendum'?'reports.amend':input.action==='void'?'reports.void':input.action==='verify'||input.action==='reject'?'corrections.review':'corrections.write';return inspectionJson(await nativeCaseAction(await nativeCaseAccess(request,permission),input));}catch(error){return nativeCaseError(error);}}
