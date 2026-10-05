import type { ensureDatabase } from '../db/bootstrap';
import { getPortalDepartment } from './department-portal';
import { emptyDocumentState,normalizeDocument,type DocumentState,type DocumentVersion,type DocumentAcknowledgement } from './document-workflow';
type Database=Awaited<ReturnType<typeof ensureDatabase>>;
type PolicyRow={id:string;title:string;policyNumber:string;category:string;effectiveDate:string;body:string;status:string;updatedAt:string};
export class DocumentConflict extends Error {}
const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64');
const likePrefix=(value:string)=>value.replace(/[!%_]/g,character=>'!'+character)+'%';
const decode=<T>(value:string):T=>JSON.parse(Buffer.from(value,'base64').toString('utf8'));
export async function documentKeys(id:string) {
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw Error('Choose a saved document.');
  const department=(await getPortalDepartment()).id;
  return {department,state:`document-control:${department}:${id}`,versions:`document-version:${department}:${id}:`,acks:`document-ack:${department}:${id}:`};
}
async function policyRow(db:Database,id:string){return db.prepare('SELECT id,title,policy_number policyNumber,category,effective_date effectiveDate,body,status,updated_at updatedAt FROM policies WHERE id=?').bind(id).first<PolicyRow>();}
async function stateRow(db:Database,key:string){const row=await db.prepare('SELECT value FROM system_meta WHERE key=? LIMIT 1').bind(key).first<{value:string}>();return {encoded:row?.value??null,state:row?decode<DocumentState>(row.value):emptyDocumentState()};}
function updateState(db:Database,key:string,encoded:string|null,state:DocumentState) {
  return encoded===null?db.prepare('INSERT INTO system_meta(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO NOTHING').bind(key,encode(state)).expectChanges(1):db.prepare('UPDATE system_meta SET value=?,updated_at=CURRENT_TIMESTAMP WHERE key=? AND value=?').bind(encode(state),key,encoded).expectChanges(1);
}
function audit(db:Database,id:string,action:string,actor:string){return db.prepare("INSERT INTO record_revisions(id,record_type,record_id,revision_number,action,summary,actor) SELECT ?,'policy',?,COALESCE(MAX(revision_number),0)+1,?,?,? FROM record_revisions WHERE record_type='policy' AND record_id=?").bind(crypto.randomUUID(),id,action,action,actor,id);}
async function batch(db:Database,writes:Parameters<Database['batch']>[0]) {try{await db.batch(writes);}catch(e){if(e instanceof Error&&(e.message.includes('SAVE_CONFLICT')||e.message.includes('duplicate key')))throw new DocumentConflict('This document changed. Your draft is kept. Reload the saved version before retrying.');throw e;}}
export async function documentControls(db:Database) {
  const department=(await getPortalDepartment()).id,prefix=`document-control:${department}:`;
  const rows=await db.prepare('SELECT key,value FROM system_meta WHERE key LIKE ? ESCAPE \'!\'').bind(likePrefix(prefix)).all<{key:string;value:string}>();
  return new Map(rows.results.map(row=>[row.key.slice(prefix.length),decode<DocumentState>(row.value)]));
}
export async function readDocumentWorkflow(db:Database,id:string,employeeId:string,manager:boolean) {
  const keys=await documentKeys(id),row=await policyRow(db,id);
  if(!row)return null;
  const current=await stateRow(db,keys.state);
  if(!manager&&(current.state.archived||!current.state.publishedVersion&&row.status==='Draft'))return null;
  const versions=await db.prepare('SELECT value FROM system_meta WHERE key LIKE ? ESCAPE \'!\'').bind(likePrefix(keys.versions)).all<{value:string}>();
  const all=versions.results.map(row=>decode<DocumentVersion>(row.value)).sort((a,b)=>b.number-a.number);
  const published=all.find(version=>version.id===current.state.publishedVersion);
  const acknowledgements=manager||published?await db.prepare('SELECT value FROM system_meta WHERE key LIKE ? ESCAPE \'!\'').bind(likePrefix(manager?keys.acks:keys.acks+published!.id+':')).all<{value:string}>():{results:[]};
  const acks=acknowledgements.results.map(row=>decode<DocumentAcknowledgement>(row.value));
  const currentAcks=acks.filter(ack=>ack.version===published?.id);
  return {state:manager?current.state:{...current.state,draft:null,lastOperation:undefined},versions:all.map(v=>({...v,recipients:manager?v.recipients:[]})),
    acknowledgement:currentAcks.find(ack=>ack.employeeId===employeeId)?{acknowledgedAt:currentAcks.find(ack=>ack.employeeId===employeeId)!.acknowledgedAt}:null,
    canAcknowledge:Boolean(published?.requiresAcknowledgement&&employeeId&&published.recipients.some(person=>person.id===employeeId)&&!current.state.archived),
    acknowledgementReport:manager&&published?published.recipients.map(person=>({employeeId:person.id,name:person.name,acknowledgedAt:currentAcks.find(ack=>ack.employeeId===person.id)?.acknowledgedAt??null})):[],
    historicalReports:manager?Object.fromEntries(all.filter(version=>version.requiresAcknowledgement).map(version=>[version.id,version.recipients.map(person=>({employeeId:person.id,name:person.name,acknowledgedAt:acks.find(ack=>ack.version===version.id&&ack.employeeId===person.id)?.acknowledgedAt??null}))])):{},
  };
}
export async function saveDocumentDraft(db:Database,id:string,input:unknown,revision:string,actor:string) {
  const content=normalizeDocument(input),keys=await documentKeys(id),row=await policyRow(db,id),current=await stateRow(db,keys.state);
  if(current.state.draft&&JSON.stringify(current.state.draft)===JSON.stringify(content)&&!current.state.archived)return current.state;
  if(current.state.revision!==revision)throw new DocumentConflict('Another editor saved this document. Keep your draft and reload before saving.');
  if(current.state.archived)throw Error('Restore the document before editing.');
  const state={...current.state,revision:crypto.randomUUID(),draft:content,lastOperation:{action:'saveDraft',revision}};
  const writes=[updateState(db,keys.state,current.encoded,state)];
  const baselineExists=row&&!current.state.publishedVersion?await db.prepare('SELECT value FROM system_meta WHERE key=? LIMIT 1').bind(keys.versions+'legacy').first():null;
  if(row&&row.status!=='Draft'&&!current.state.publishedVersion&&!baselineExists) {
    // Capture pre-upgrade text as a legacy snapshot without inventing a publication receipt.
    const baseline:DocumentVersion={id:'legacy',number:0,legacy:true,content:{title:row.title,policyNumber:row.policyNumber,category:row.category,effectiveDate:row.effectiveDate,body:row.body,documentType:'Policy',sourceUrl:''},publishedAt:'',publishedBy:'',requiresAcknowledgement:false,recipients:[]};
    writes.push(db.prepare('UPDATE policies SET id=id WHERE id=? AND title=? AND policy_number=? AND category=? AND effective_date=? AND body=? AND status=?').bind(id,row.title,row.policyNumber,row.category,row.effectiveDate,row.body,row.status).expectChanges(1));
    writes.push(db.prepare('INSERT INTO system_meta(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP)').bind(keys.versions+'legacy',encode(baseline)).expectChanges(1));
  }
  if(!row)writes.push(db.prepare("INSERT INTO policies(id,title,policy_number,category,effective_date,body,status,created_by,updated_by,updated_at) VALUES(?,?,?,?,?,'','Draft',?,?,CURRENT_TIMESTAMP)").bind(id,content.title,content.policyNumber,content.category,content.effectiveDate,actor,actor).expectChanges(1));
  writes.push(audit(db,id,'Draft saved (published text retained)',actor));
  await batch(db,writes);return state;
}
export async function publishDocument(db:Database,id:string,revision:string,requiresAcknowledgement:boolean,actor:string) {
  const keys=await documentKeys(id),current=await stateRow(db,keys.state);
  if(current.state.lastOperation?.action==='publish'&&current.state.lastOperation.revision===revision)return current.state;
  if(current.state.revision!==revision)throw new DocumentConflict('The draft changed. Reload it and review before publishing.');
  if(!current.state.draft||current.state.archived)throw Error('Save an active draft before publishing.');
  const content=normalizeDocument(current.state.draft);
  if(!content.body&&!content.sourceUrl)throw Error('Add document text or a reference before publishing.');
  if(!content.effectiveDate)throw Error('Enter the reviewed effective date before publishing.');
  const prior=await db.prepare('SELECT value FROM system_meta WHERE key LIKE ? ESCAPE \'!\'').bind(likePrefix(keys.versions)).all<{value:string}>();
  const recipients=requiresAcknowledgement?(await db.prepare('SELECT e.id,e.name FROM employees e LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND (ep.end_date IS NULL OR ep.end_date=? OR ep.end_date>=?) ORDER BY e.name').bind('',new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())).all<{id:string;name:string}>()).results:[];
  if(requiresAcknowledgement&&!recipients.length)throw Error('No active members are available for acknowledgement. Review the roster or publish without requiring acknowledgement.');
  const version:DocumentVersion={id:crypto.randomUUID(),number:Math.max(0,...prior.results.map(row=>decode<DocumentVersion>(row.value).number))+1,legacy:false,content,publishedAt:new Date().toISOString(),publishedBy:actor,requiresAcknowledgement,recipients};
  const state:DocumentState={...current.state,revision:crypto.randomUUID(),draft:null,publishedVersion:version.id,publishedType:content.documentType,publishedReference:content.sourceUrl,lastOperation:{action:'publish',revision}};
  await batch(db,[updateState(db,keys.state,current.encoded,state),db.prepare('INSERT INTO system_meta(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP)').bind(keys.versions+version.id,encode(version)).expectChanges(1),
    db.prepare("UPDATE policies SET title=?,policy_number=?,category=?,effective_date=?,body=?,status='Active',updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(content.title,content.policyNumber,content.category,content.effectiveDate,content.body,actor,id).expectChanges(1),audit(db,id,'Published version '+version.number,actor)]);
  return state;
}
export async function archiveDocument(db:Database,id:string,revision:string,archived:boolean,actor:string) {
  const keys=await documentKeys(id),current=await stateRow(db,keys.state);
  if(current.state.revision!==revision)throw new DocumentConflict('This document changed. Reload before changing its archive status.');
  if(!await policyRow(db,id))throw Error('Document not found.');
  if(current.state.archived===archived)return current.state;
  const state={...current.state,revision:crypto.randomUUID(),archived,lastOperation:{action:archived?'archive':'restore',revision}};
  await batch(db,[updateState(db,keys.state,current.encoded,state),audit(db,id,archived?'Archived (versions retained)':'Restored',actor)]);return state;
}
export async function acknowledgeDocument(db:Database,id:string,version:string,employeeId:string,actor:string) {
  const keys=await documentKeys(id),current=await stateRow(db,keys.state);
  if(current.state.archived||current.state.publishedVersion!==version)throw new DocumentConflict('The published document changed. Read the current version before acknowledging.');
  const stored=await db.prepare('SELECT value FROM system_meta WHERE key=? LIMIT 1').bind(keys.versions+version).first<{value:string}>();
  const published=stored?decode<DocumentVersion>(stored.value):null;
  if(!published?.requiresAcknowledgement||!employeeId||!published.recipients.some(person=>person.id===employeeId))throw Error('Your verified account is not assigned to acknowledge this version.');
  const key=keys.acks+version+':'+employeeId;
  const existing=await db.prepare('SELECT value FROM system_meta WHERE key=? LIMIT 1').bind(key).first<{value:string}>();
  if(existing)return decode<DocumentAcknowledgement>(existing.value);
  const ack:DocumentAcknowledgement={version,employeeId,actor,acknowledgedAt:new Date().toISOString()};
  try {await batch(db,[db.prepare('UPDATE system_meta SET value=value WHERE key=? AND value=?').bind(keys.state,current.encoded).expectChanges(1),db.prepare('INSERT INTO system_meta(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO NOTHING').bind(key,encode(ack)).expectChanges(1)]);}
  catch(error){const duplicate=await db.prepare('SELECT value FROM system_meta WHERE key=? LIMIT 1').bind(key).first<{value:string}>();if(duplicate&&error instanceof DocumentConflict)return decode<DocumentAcknowledgement>(duplicate.value);throw error;}
  const saved=await db.prepare('SELECT value FROM system_meta WHERE key=? LIMIT 1').bind(key).first<{value:string}>();
  if(!saved)throw Error('Acknowledgement could not be confirmed. Retry.');
  return decode<DocumentAcknowledgement>(saved.value);
}
