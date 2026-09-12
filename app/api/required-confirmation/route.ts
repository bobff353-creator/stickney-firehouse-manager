import { ensureDatabase } from '../../../db/bootstrap';
import { hasPermission } from '../../server-permissions';
const json = (data: unknown,status=200) => Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request: Request) {
  if (!request.headers.get('x-authenticated-user-id')) return json({error:'Sign in required.'},401);
  try {
    const db=await ensureDatabase();
    const row=await db.prepare("SELECT m.id version,m.title,m.message,m.enabled FROM portal_confirmation_setting s LEFT JOIN portal_confirmation_messages m ON m.id=s.message_id WHERE s.department_id='14a76771-4c24-481b-8def-e6cce005c17b'").first();
    return json(row || {version:null,title:'Department confirmation',message:'',enabled:false});
  } catch {return json({error:'The confirmation message could not be loaded. Try again.'},503);}
}
export async function PUT(request: Request) {
  try {
    const db=await ensureDatabase();
    if (!await hasPermission(request,db,'scheduling.manage')) return json({error:'Schedule administrator access is required.'},403);
    const body=await request.json();
    const title=String(body.title??'').trim(),message=String(body.message??'').trim();
    if (!title || title.length>120 || message.length>4000 || (body.enabled && !message)) return json({error:'Enter a title and a message before enabling confirmation (up to 4,000 characters).'},400);
    const encoded=Buffer.from(JSON.stringify({title,message,enabled:body.enabled===true,version:body.version??null,actor:request.headers.get('oai-authenticated-user-email')??''})).toString('base64');
    const result=await db.prepare('SELECT save_portal_confirmation(?) AS version').bind(encoded).first();
    return json({ok:true,...result});
  } catch {return json({error:'Not saved. Another administrator may have changed this message. Reload it and try again.'},409);}
}
export async function POST(request: Request) {
  const user=request.headers.get('x-authenticated-user-id');
  if (!user) return json({error:'Sign in required.'},401);
  try {
    const body=await request.json();
    if (body.confirmed !== true || !/^[0-9a-f-]{36}$/i.test(String(body.version??''))) return json({error:'Read the message and select I confirm.'},400);
    const db=await ensureDatabase();
    await db.prepare('SELECT confirm_portal_message(?,?) AS confirmed').bind(body.version,user).first();
    return json({ok:true});
  } catch {return json({error:'Your confirmation was not saved, or the message changed. Reload the message and confirm again.'},409);}
}
