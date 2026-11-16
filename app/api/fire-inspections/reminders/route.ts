import {nativePublicAccess} from '../../../fire-inspections/access-context';
import {inspectionJson} from '../../../fire-inspections/server';
import {reminderDraftStatus,saveReminderDraftPolicy} from '../../../fire-inspections/reminder-draft-service';
import {reminderAccess,reminderBody,reminderContext,reminderError} from '../../../fire-inspections/reminder-runtime';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const access=await reminderAccess(request,'reminders.read'),url=new URL(request.url);return inspectionJson({...await reminderDraftStatus(reminderContext(access),{before:url.searchParams.get('before')??undefined,limit:url.searchParams.has('limit')?Number(url.searchParams.get('limit')):undefined}),access:nativePublicAccess(access)});}catch(error){return reminderError(error);}}
export async function POST(request:Request){try{const access=await reminderAccess(request,'reminders.manage');return inspectionJson(await saveReminderDraftPolicy(reminderContext(access),await reminderBody(request)));}catch(error){return reminderError(error);}}
