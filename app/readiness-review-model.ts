import { validQueueDate } from './task-queue-model';
import { staffingRoles } from './staffing-eligibility';
import { scheduleSafetyIssues, type SafetySlot, type ScheduleSafetyRules } from './schedule-safety';
import { apparatusCheckRequired, scheduledCheckCompleted } from './lib/fleet-projections';
import { assetAttention } from './inventory-asset-attention';
import type { PilotTaskRow } from './task-queue-model';
export const reviewGroups=['Crew','Apparatus','Checks','Preplans','Credentials','Prevention'] as const;
export type ReviewGroup=typeof reviewGroups[number];
export type ReviewSignal={id:string;group:ReviewGroup;severity:'Urgent'|'Review'|'Unknown';title:string;detail:string;date:string;href:string;shiftHref?:string};
export type ReviewSource={group:ReviewGroup;state:'ready'|'restricted'|'unavailable';note:string};
export type ReviewPacket={items:ReviewSignal[];sources:ReviewSource[];today:string;through:string;generatedAt:string};
export type ReviewMember={id:string;name:string;rank:string;driverStatus:string;actingOfficerEligible:number;singleRole:number};
type Row=Record<string,unknown>;
const text=(value:unknown)=>typeof value==='string'?value.trim():'';
const url=(page:string,params:Record<string,string>={})=>'/?'+new URLSearchParams({display:'portal',page,...params}).toString();
export const shiftReviewUrl=(date:string)=>url('scheduling',{adminTask:'calendar',scheduleDate:date});
export function reviewThrough(today:string,days:number){const date=new Date(today+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);}
export function crewReview(slots:SafetySlot[],members:ReviewMember[],rules:ScheduleSafetyRules,today:string,through:string):ReviewSignal[]{
  const signals:ReviewSignal[]=scheduleSafetyIssues(slots,members.map(m=>({...m,roles:JSON.stringify(staffingRoles(m))})),rules,today,through).map(issue=>({id:'crew:'+issue.id,group:'Crew',severity:issue.kind==='invalid'?'Unknown':'Review',title:issue.employeeName||'Member assignment',detail:issue.message,date:issue.date,href:shiftReviewUrl(issue.date)}));
  for(const slot of slots)if(slot.entryDate>=today&&slot.entryDate<=through&&slot.status!=='cancelled'&&slot.status!=='canceled'&&(slot.status==='open'||slot.status==='filled'&&!slot.employeeId))signals.push({id:'open:'+slot.id,group:'Crew',severity:slot.entryDate===today?'Urgent':'Review',title:slot.role+' · '+slot.entryDate,detail:'Saved position is unfilled. '+slot.startTime+'–'+slot.endTime,date:slot.entryDate,href:shiftReviewUrl(slot.entryDate)});
  for(const member of members)if(!member.driverStatus.trim()){
    const first=slots.find(slot=>slot.employeeId===member.id&&slot.status==='filled'&&slot.entryDate>=today&&slot.entryDate<=through);
    if(first)signals.push({id:'profile:'+member.id,group:'Crew',severity:'Unknown',title:member.name,detail:'Driver status is not recorded. Review the profile; existing staffing eligibility rules remain unchanged.',date:first.entryDate,href:shiftReviewUrl(first.entryDate)});
  }
  return signals;
}
export function credentialReview(rows:PilotTaskRow[],slots:SafetySlot[]|null,members:Map<string,string>,today:string,through:string):ReviewSignal[]{
  const signals:ReviewSignal[]=[];
  const byMember=new Map<string,SafetySlot[]>();
  for(const slot of slots||[])if(slot.status==='filled'&&slot.employeeId&&slot.entryDate>=today&&slot.entryDate<=through){const list=byMember.get(slot.employeeId)||[];list.push(slot);byMember.set(slot.employeeId,list);}
  for(const row of rows){const d:unknown=JSON.parse(row.payload);if(!d||typeof d!=='object'||Array.isArray(d))throw Error('Credential data unavailable.');const data=d as Row;
    if(row.kind!=='credential'||data.test===true||data.status!=='saved')continue;
    const due=text(data.dueDate),valid=validQueueDate(due),ids=Array.isArray(data.employeeIds)?data.employeeIds.filter((id):id is string=>typeof id==='string'):[];
    const assignments=[...new Map(ids.flatMap(id=>byMember.get(id)||[]).map(slot=>[slot.id,slot])).values()];
    const affected=assignments.filter(s=>!valid||s.entryDate>=due).sort((a,b)=>a.entryDate.localeCompare(b.entryDate)||a.id.localeCompare(b.id));
    if(valid&&due>through&&data.verified===true)continue;
    const who=ids.map(id=>members.get(id)||'Member record unavailable').join(', ')||'Member not linked';
    signals.push({id:'credential:'+row.id,group:'Credentials',severity:!valid||data.verified!==true?'Unknown':due<today?'Urgent':'Review',title:who+' · '+(text(data.title)||'Credential'),date:valid?due:'',detail:[!due?'Renewal date not recorded':!valid?'Renewal date needs review':'Recorded renewal: '+due,data.verified===true?'Evidence marked verified':'Evidence not marked verified',slots===null?'Saved staffing could not be reviewed':`${affected.length} saved shift(s) ${valid?'on or after this date':'need a date/evidence review'}${affected[0]?' · First: '+affected[0].entryDate+' '+affected[0].role:''}`,'Role applicability is not established; review evidence before making staffing decisions.'].join(' · '),href:url('training',{trainingRecord:row.id,trainingTab:'Credentials & task books'}),shiftHref:affected[0]?shiftReviewUrl(affected[0].entryDate):undefined});
  }
  return signals;
}
export function apparatusReview(fleet:Row[],equipment:Row[],repairs:Row[],exceptions:Row[],now=Date.now()):ReviewSignal[]{
  const signals:ReviewSignal[]=[];
  for(const row of fleet){const status=text(row.status);if(status==='in_service')continue;signals.push({id:'apparatus:'+text(row.id),group:'Apparatus',severity:['out_of_service','impaired'].includes(status)?'Urgent':status==='in_repair'?'Review':'Unknown',title:text(row.unit_name)||'Apparatus',detail:'Saved service status: '+(status||'Not recorded'),date:'',href:'/inventory?'+new URLSearchParams({apparatus:text(row.id)}).toString()});}
  const problems=new Set([...repairs.filter(r=>!['closed','completed','cancelled','canceled','resolved'].includes(text(r.status))),...exceptions.filter(r=>!['resolved','cancelled','canceled'].includes(text(r.status)))].map(r=>text(r.equipment_id)).filter(Boolean));
  for(const row of equipment){if(row.retired_at||row.service_status==='retired')continue;const flags=assetAttention(row,now,problems.has(text(row.id)));if(!['in_service','out_of_service','in_repair'].includes(text(row.service_status)))flags.push({kind:'status',severity:'unknown',label:'Service status not recorded or requires review'});if(!flags.length)continue;
    signals.push({id:'asset:'+text(row.id),group:'Apparatus',severity:flags.some(f=>f.severity==='critical')?'Urgent':flags.some(f=>f.severity==='unknown')?'Unknown':'Review',title:text(row.name)||'Equipment',detail:flags.map(f=>f.label).join(' · '),date:'',href:'/inventory?'+new URLSearchParams({equipment:text(row.id)}).toString()});
  }
  return signals;
}
export function checkReview(schedules:Row[],fleet:Row[],checks:Row[],today:string):ReviewSignal[]{
  const byUnit=new Map(fleet.map(row=>[text(row.id),row])),day=new Date(today+'T12:00:00Z').getUTCDay();
  return schedules.filter(s=>s.active===true&&Number(s.day_of_week)===day).flatMap(schedule=>{
    const unit=byUnit.get(text(schedule.apparatus_id)),kind=text(schedule.check_type),id='check:'+text(schedule.id)+':'+today;
    const href='/inventory?'+new URLSearchParams({apparatus:text(schedule.apparatus_id)}).toString();
    if(!unit)return [{id,group:'Checks' as const,severity:'Unknown' as const,title:'Check schedule · '+kind,detail:'Linked apparatus is unavailable. Verify the saved schedule.',date:today,href}];
    if(!apparatusCheckRequired(unit.status,kind))return [];
    const matched=checks.filter(c=>c.apparatus_id===schedule.apparatus_id&&c.check_type===kind);
    if(matched.some(c=>scheduledCheckCompleted(c,kind,today)))return [];
    return [{id,group:'Checks' as const,severity:!text(unit.status)?'Unknown' as const:'Review' as const,title:(text(unit.unit_name)||'Apparatus')+' · '+kind,detail:(matched.some(c=>c.status==='in_progress')?'Check in progress':'Completion not recorded')+' · Scheduled today '+text(schedule.start_time).slice(0,5)+'–'+text(schedule.end_time).slice(0,5)+'. Review the source schedule; this is not an overdue determination.',date:today,href}];
  });
}
export function filterReview(items:ReviewSignal[],group:string,severity:string,query:string){const needle=query.trim().toLowerCase();return items.filter(item=>(group==='All'||item.group===group)&&(severity==='All'||item.severity===severity)&&(!needle||[item.title,item.detail,item.date].join(' ').toLowerCase().includes(needle)));}
export function reviewCsv(packet:ReviewPacket,items:ReviewSignal[],origin:string){
  const cell=(value:unknown)=>{let text=String(value??'');if(/^[\s]*[=+@-]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
  const lines=[['Readiness review snapshot',packet.generatedAt],['Staffing range',packet.today,packet.through],['Counts are review signals, not a readiness certification'],...packet.sources.map(source=>['Source',source.group,source.state,source.note]),['Group','Review level','Title','Detail','Recorded date','Source link','Saved staffing link'],...items.map(item=>[item.group,item.severity,item.title,item.detail,item.date,new URL(item.href,origin).href,item.shiftHref?new URL(item.shiftHref,origin).href:''])];
  return '\uFEFF'+lines.map(row=>row.map(cell).join(',')).join('\r\n');
}
