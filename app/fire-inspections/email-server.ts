import {getSupabaseServerClient} from '../supabase-server';
import {reportText} from './model';
import {loadReport,buildInspectionPdf} from './report-pdf';
import type {InspectionDb} from './server';
export const inspectionSender=()=>process.env.INSPECTION_EMAIL_FROM?.trim()||'Stickney Fire Department <bwyant@stickneyfire.com>';
const bucket='stickney-fire-inspections-pilot',base='https://api.resend.com';
export type Delivery={id:string;recordId:string;recordVersion:number;recipient:string;sender:string;subject:string;reportText:string;pdfKey:string;providerId:string|null;status:string;error:string;createdAt:string;updatedAt:string};
export const deliveryColumns='id,record_id recordId,record_version recordVersion,recipient,sender,subject,report_text reportText,pdf_key pdfKey,provider_id providerId,status,error,created_at createdAt,updated_at updatedAt';
export const publicDelivery=(d:Delivery)=>({id:d.id,recordId:d.recordId,recordVersion:d.recordVersion,recipient:d.recipient,sender:d.sender,status:d.status,error:d.error,createdAt:d.createdAt,updatedAt:d.updatedAt});
export async function provider(path:string,init:RequestInit={}){return fetch(base+path,{...init,headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json',...init.headers},signal:AbortSignal.timeout(20000),cache:'no-store'});}
export async function emailSetup(){
 const sender=inspectionSender(),configured=Boolean(process.env.RESEND_API_KEY);let domainStatus='Not checked';
 if(configured){try{const r=await provider('/domains');if(r.ok){const j=await r.json(),address=sender.match(/<([^>]+)>/)?.[1]||sender,domain=address.split('@')[1]?.toLowerCase();domainStatus=j.data?.find((d:{name:string})=>d.name.toLowerCase()===domain)?.status||'Domain not found';}else domainStatus='Could not verify with this API key';}catch{domainStatus='Could not check right now';}}
 return{configured,sender,domainStatus};
}
async function findDelivery(db:InspectionDb,department:string,id:string){return db.prepare(`SELECT ${deliveryColumns} FROM fire_inspection_email_deliveries WHERE department_id=? AND id=?`).bind(department,id).first<Delivery>();}
export async function prepareDelivery(db:InspectionDb,department:string,actor:string,id:string,version:number,recipient:string){
 if(!process.env.RESEND_API_KEY)throw Error('Email is not configured. The administrator must configure the report email provider first.');
 const existing=await db.prepare(`SELECT ${deliveryColumns} FROM fire_inspection_email_deliveries WHERE department_id=? AND record_id=? AND record_version=? AND recipient=?`).bind(department,id,version,recipient).first<Delivery>();if(existing)return existing;
 const {record,photos}=await loadReport(db,department,id,version);
 if(record.archived)throw Error('Restore this inspection before emailing a report.');
 if(record.data.status!=='Completed'&&!record.data.test)throw Error('Finish the inspection before emailing its report.');
 if(record.data.test&&recipient!=='bobff353@gmail.com')throw Error('Test reports can only be sent to bobff353@gmail.com.');
 const bytes=await buildInspectionPdf(record,photos),deliveryId=crypto.randomUUID(),pdfKey=`${department}/report-emails/${deliveryId}.pdf`,now=new Date().toISOString(),client=await getSupabaseServerClient();
 const uploaded=await client.storage.from(bucket).upload(pdfKey,bytes,{contentType:'application/pdf',upsert:false});if(uploaded.error)throw Error('The report could not be preserved for delivery. No email was sent.');
 try{await db.prepare('INSERT INTO fire_inspection_email_deliveries(id,department_id,record_id,record_version,recipient,sender,subject,report_text,pdf_key,status,created_at,updated_at,created_by) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? FROM fire_inspection_pilot_records WHERE id=? AND department_id=? AND version=? AND archived=0 ON CONFLICT(record_id,record_version,recipient) DO NOTHING').bind(deliveryId,department,id,version,recipient,inspectionSender(),`${record.data.test?'TEST / TRAINING - ':''}Fire inspection report - ${record.data.title} - ${record.data.actualDate||'Draft'}`,reportText(record),pdfKey,'Prepared',now,now,actor,id,department,version).run();}
 catch{await client.storage.from(bucket).remove([pdfKey]);throw Error('The delivery record could not be saved. No email was sent. Retry.');}
 const saved=await db.prepare(`SELECT ${deliveryColumns} FROM fire_inspection_email_deliveries WHERE department_id=? AND record_id=? AND record_version=? AND recipient=?`).bind(department,id,version,recipient).first<Delivery>();
 if(saved?.id!==deliveryId)await client.storage.from(bucket).remove([pdfKey]);
 if(!saved)throw Error('The inspection changed before delivery was prepared. Refresh and review its latest version.');return saved;
}
export async function sendDelivery(db:InspectionDb,department:string,d:Delivery){
 // Reuse one immutable request and provider idempotency key, including after an uncertain network response.
 if(d.providerId||!['Prepared','Unconfirmed','Failed'].includes(d.status))return d;
 if(Date.now()-Date.parse(d.createdAt)>23*60*60*1000)throw Error('This delivery is outside the safe retry window. Check the provider history before any new send. No duplicate was sent.');
 const client=await getSupabaseServerClient(),stored=await client.storage.from(bucket).download(d.pdfKey);if(stored.error||!stored.data)throw Error('The preserved PDF is unavailable. No email was sent. Retry.');
 const payload={from:d.sender,to:[d.recipient],subject:d.subject,text:`The saved inspection report is attached as a PDF.\n\n${d.reportText}`,attachments:[{filename:`inspection-${d.recordId}-v${d.recordVersion}.pdf`,content:Buffer.from(await stored.data.arrayBuffer()).toString('base64')}]};
 let status='Unconfirmed',error='The provider response was not confirmed. Use Retry safely; it reuses the same report and delivery key.',providerId:string|null=null;
 try{const r=await provider('/emails',{method:'POST',headers:{'Idempotency-Key':d.id},body:JSON.stringify(payload)}),j=await r.json();if(r.ok&&typeof j.id==='string'){status='Accepted';providerId=j.id;error='';}else if(r.status>=400&&r.status<500){status='Failed';error=r.status===403?'The sender or provider permission was rejected. Verify bwyant@stickneyfire.com in the email provider.':`Email provider rejected this send (${r.status}). Check the sender and recipient before retrying.`;}}catch{/* Keep an uncertain result distinct from a confirmed rejection. */}
 // A concurrent retry must never replace a confirmed acceptance with an uncertain outcome.
 await db.prepare('UPDATE fire_inspection_email_deliveries SET status=?,error=?,provider_id=?,updated_at=? WHERE department_id=? AND id=? AND provider_id IS NULL').bind(status,error,providerId,new Date().toISOString(),department,d.id).run();
 return await findDelivery(db,department,d.id)||d;
}
export async function refreshDelivery(db:InspectionDb,department:string,id:string){
 const d=await findDelivery(db,department,id);if(!d)throw Error('Delivery not found.');if(!d.providerId)return d;
 const r=await provider(`/emails/${encodeURIComponent(d.providerId)}`);if(!r.ok)throw Error('Delivery status could not be checked. The existing status is unchanged.');const j=await r.json();
 const statuses:Record<string,string>={sent:'Sent',delivered:'Delivered',delivery_delayed:'Delayed',bounced:'Bounced',complained:'Complained',failed:'Failed',opened:'Delivered',clicked:'Delivered'};
 const status=statuses[j.last_event]||d.status;
 await db.prepare('UPDATE fire_inspection_email_deliveries SET status=?,updated_at=? WHERE department_id=? AND id=?').bind(status,new Date().toISOString(),department,id).run();return await findDelivery(db,department,id)||d;
}
