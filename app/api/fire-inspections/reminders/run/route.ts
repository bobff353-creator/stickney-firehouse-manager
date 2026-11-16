import {inspectionJson} from '../../../../fire-inspections/server';
import {ReminderDraftError,runReminderDraftPage} from '../../../../fire-inspections/reminder-draft-service';
import {reminderAccess,reminderBody,reminderContext,reminderError} from '../../../../fire-inspections/reminder-runtime';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function POST(request:Request){try{const access=await reminderAccess(request,'automation.run'),body=await reminderBody(request);if(Object.keys(body).some(key=>!['requestId','runId'].includes(key))||body.runId!==undefined&&body.requestId!==undefined)throw new ReminderDraftError('Use a new requestId or a saved runId. The server supplies the date and department.',400);return inspectionJson(await runReminderDraftPage(reminderContext(access),{mode:'manual',requestId:typeof body.requestId==='string'?body.requestId:undefined,runId:typeof body.runId==='string'?body.runId:undefined}));}catch(error){return reminderError(error);}}
