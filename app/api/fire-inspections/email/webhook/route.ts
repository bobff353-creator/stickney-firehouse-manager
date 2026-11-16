import {Webhook,WebhookVerificationError} from 'standardwebhooks';
import {createHash} from 'node:crypto';
import {backgroundDatabase} from '../../../../background-database';
import {getPortalDepartment} from '../../../../department-portal';
import {applyInspectionEmailEvent,parseInspectionProviderEvent,InspectionEmailEventError} from '../../../../fire-inspections/inspection-email-events';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function boundedBody(request:Request){const max=128*1024;if(Number(request.headers.get('content-length'))>max)throw new InspectionEmailEventError('Webhook payload exceeds the supported size.',413);const reader=request.body?.getReader();if(!reader)throw new InspectionEmailEventError('Webhook payload is missing.',400);const parts:Uint8Array[]=[];let size=0;try{while(true){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>max){await reader.cancel();throw new InspectionEmailEventError('Webhook payload exceeds the supported size.',413);}parts.push(item.value);}}finally{reader.releaseLock();}const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new InspectionEmailEventError('Webhook payload is not valid UTF-8.',400);}}
export async function POST(request:Request){
 const secret=process.env.INSPECTION_RESEND_WEBHOOK_SECRET||process.env.RESEND_WEBHOOK_SECRET;if(!secret)return json({error:'Inspection email event verification is not configured. No delivery state was changed.'},503);
 try{
  const eventId=request.headers.get('svix-id')??'',timestamp=request.headers.get('svix-timestamp')??'',signature=request.headers.get('svix-signature')??'';
  if(!/^[A-Za-z0-9_.:-]{1,200}$/.test(eventId)||!/^\d{1,14}$/.test(timestamp)||signature.length>4000)return json({error:'Invalid webhook signature.'},401);
  const body=await boundedBody(request);let verified:unknown;
  try{verified=new Webhook(secret).verify(body,{'webhook-id':eventId,'webhook-timestamp':timestamp,'webhook-signature':signature});}catch(error){if(error instanceof WebhookVerificationError)return json({error:'Invalid webhook signature.'},401);if(error instanceof SyntaxError)return json({error:'The signed webhook payload is not valid JSON.'},400);return json({error:'Webhook verification could not be completed. No delivery state was changed.'},503);}
  const event=parseInspectionProviderEvent(verified);if(!event)return json({accepted:true,ignored:true});
  // No portal lookup, privileged connection or delivery query occurs before the signature check.
  const department=await getPortalDepartment();if(department.isolated)return json({error:'Inspection email events are not configured for this department.'},503);
  return json(await applyInspectionEmailEvent(backgroundDatabase(),department.id,eventId,createHash('sha256').update(body).digest('hex'),event));
 }catch(error){if(error instanceof InspectionEmailEventError)return json({error:error.message,code:error.code},error.status);console.error('Inspection email event persistence paused; no email was sent.');return json({error:'The signed delivery event could not be persisted. Retry this same event.'},503);}
}
