import {completedMemberIds} from './training/completion-members.ts';
export type TaskSource = 'Inspections' | 'Training' | 'Credentials' | 'Repairs' | 'Hydrants' | 'Outreach' | 'Replacements' | 'Preplans';
export type DueState = 'Overdue' | 'Today' | 'Next 30 days' | 'Later' | 'Date needed' | 'Date needs review';
export type QueueTask = { id: string; source: TaskSource; title: string; detail: string; status: string; dueDate: string; invalidDate: boolean; assignedIds: string[]; assignees: string[]; href: string };
export type PilotTaskRow = { id: string; kind: string; payload: string; archived?:boolean|number };
type Data = Record<string, unknown>;
const text = (v: unknown) => typeof v === 'string' ? v.trim() : '';
const strings = (v: unknown) => Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && Boolean(s.trim())).map(s=>s.trim()) : [];
export function validQueueDate(value: string) {
  const date = new Date(value + 'T12:00:00Z');
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function chicagoQueueDate(now = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
export function taskDueState(task: Pick<QueueTask, 'dueDate' | 'invalidDate'>, today: string): DueState {
  if(task.invalidDate || (task.dueDate && !validQueueDate(task.dueDate))) return 'Date needs review';
  if(!task.dueDate) return 'Date needed';
  if(task.dueDate < today) return 'Overdue';
  if(task.dueDate === today) return 'Today';
  const through = new Date(today + 'T12:00:00Z'); through.setUTCDate(through.getUTCDate() + 30);
  return task.dueDate <= through.toISOString().slice(0,10) ? 'Next 30 days' : 'Later';
}
const ranks: Record<DueState, number> = { Overdue: 0, Today: 1, 'Date needs review': 2, 'Next 30 days': 3, 'Date needed': 4, Later: 5 };
export function sortQueue(tasks: QueueTask[], today: string) { return [...tasks].sort((a,b)=>ranks[taskDueState(a,today)]-ranks[taskDueState(b,today)] || a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id)); }
function data(row: PilotTaskRow): Data {
  const value: unknown = JSON.parse(row.payload);
  if(!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Record details are unavailable.');
  return value as Data;
}
const recordHref = (page: string, key: string, id: string, tab?: string) => '/?' + new URLSearchParams({ display:'portal',page,[key]:id,...(tab ? {trainingTab:tab} : {}) }).toString();
export function inspectionTasks(rows: PilotTaskRow[], names: Map<string,string>): QueueTask[] {
  return rows.flatMap(row=>{
    const d=data(row); if(d.test===true || row.kind!=='inspection' || d.status==='Canceled')return [];
    const team=d.team && typeof d.team==='object' ? d.team as Data : {};
    const assignedIds=Array.isArray(team.assignees) ? team.assignees.map(a=>a && typeof a==='object' ? text((a as Data).id) : '').filter(Boolean) : [];
    const open=Array.isArray(d.checks) ? d.checks.filter(c=>c && typeof c==='object' && (c as Data).result==='Needs attention') as Data[] : [];
    if(d.status==='Completed' && !open.length)return [];
    const correction=d.status==='Completed';
    const dates=correction ? open.map(c=>text(c.dueDate)).filter(Boolean) : [text(d.scheduledDate)].filter(Boolean);
    const dueDate=dates.filter(validQueueDate).sort()[0] || '';
    return [{id:'inspection:'+row.id,source:'Inspections',title:text(d.title)||'Inspection',detail:[text(d.address),correction ? `${open.length} unresolved observations` : text(d.type),team.state==='Submitted' ? 'Submitted for review' : ''].filter(Boolean).join(' · '),status:correction ? 'Corrections open' : text(d.status)||'Draft',dueDate,invalidDate:dates.some(date=>!validQueueDate(date)),assignedIds,assignees:assignedIds.map(id=>names.get(id)||'Assigned member unavailable'),href:recordHref('fire-inspections','inspectionRecord',row.id)}];
  });
}
export function trainingTasks(rows: PilotTaskRow[], names: Map<string,string>): QueueTask[] {
  const decoded=rows.map(row=>({row,d:data(row)})).filter(({d})=>d.test!==true);
  const completedByAssignment=new Map<string,Set<string>>();
  for(const {row,d} of decoded)if(row.kind==='completion'&&d.status==='completed'&&text(d.assignmentId)){
    const key=text(d.assignmentId),ids=completedByAssignment.get(key)||new Set<string>();
    for(const id of completedMemberIds({kind:row.kind,archived:row.archived,data:d}))ids.add(id);completedByAssignment.set(key,ids);
  }
  return decoded.flatMap(({row,d})=>{
    if(row.kind!=='assignment' && row.kind!=='credential')return [];
    if(row.kind==='credential' ? d.status!=='saved' : d.status==='completed')return [];
    let assignedIds=strings(d.employeeIds);
    if(row.kind==='assignment'){
      const completed=completedByAssignment.get(row.id)||new Set<string>();
      if(assignedIds.length && assignedIds.every(id=>completed.has(id)))return [];
      assignedIds=assignedIds.filter(id=>!completed.has(id));
    }
    const dueDate=text(d.dueDate),credential=row.kind==='credential';
    return [{id:row.kind+':'+row.id,source:credential?'Credentials':'Training',title:text(d.title)||(credential?'Credential':'Training assignment'),detail:credential ? 'Recorded renewal date only; verify qualification in Training.' : text(d.description).slice(0,240),status:credential?'Renewal review':text(d.status)||'draft',dueDate,invalidDate:Boolean(dueDate&&!validQueueDate(dueDate)),assignedIds,assignees:assignedIds.map(id=>names.get(id)||'Assigned member unavailable'),href:recordHref('training','trainingRecord',row.id,credential?'Credentials & task books':'Assignments')}];
  });
}
export function repairTasks(rows: Data[]): QueueTask[] {
  return rows.filter(row=>!['closed','cancelled','canceled','resolved','completed'].includes(text(row.status).toLowerCase())).map(row=>{
    const raw=text(row.due_at); let dueDate='', invalidDate=false;
    if(raw){
      if(validQueueDate(raw))dueDate=raw;
      else if(validQueueDate(raw.slice(0,10)) && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(raw) && Number.isFinite(Date.parse(raw)))dueDate=chicagoQueueDate(new Date(raw));
      else invalidDate=true;
    }
    const id=text(row.id),assignedIds=strings(row.assigned_employee_ids),assignees=strings(row.assigned_employee_names);
    return {id:'repair:'+id,source:'Repairs',title:text(row.summary)||'Repair',detail:[text(row.priority),text(row.details).slice(0,200)].filter(Boolean).join(' · '),status:text(row.status)||'Open',dueDate,invalidDate,assignedIds,assignees:assignees.length ? assignees : text(row.assigned_to) ? [text(row.assigned_to)] : [],href:'/inventory?'+new URLSearchParams({adminTask:'service',workOrder:id}).toString()};
  });
}

export function preplanTasks(rows:Record<string,unknown>[]):QueueTask[]{return rows.filter(r=>['published',''].includes(text(r.publicationStatus))).map(r=>{const id=text(r.id),date=text(r.nextReviewDate);return {id:'preplan:'+id,source:'Preplans',title:text(r.name)||'Published preplan',detail:[text(r.address),r.lastVerifiedAt?'Last recorded verification: '+text(r.lastVerifiedAt):'Verification date not recorded'].filter(Boolean).join(' · '),status:'Published plan review',dueDate:date,invalidDate:Boolean(date&&!validQueueDate(date)),assignedIds:[],assignees:[],href:recordHref('field-preplans','preplan',id)};});}
