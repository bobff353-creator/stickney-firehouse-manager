import {todayChicago,type InspectionRecord} from './model';
export type InspectionReminder={id:string;recordId:string;title:string;property:string;dueDate:string;kind:'Correction'|'Reinspection'|'Routine visit';status:string};
export function dueStatus(date:string,today=todayChicago()){
 if(!date)return 'Date needed';if(date<today)return 'Past due';if(date===today)return 'Due today';const days=Math.round((Date.parse(date)-Date.parse(today))/86400000);return days<=7?'Due within 1 week':days<=14?'Due within 2 weeks':'Upcoming';
}
export function inspectionReminders(records:InspectionRecord[],includeTests=false,today=todayChicago()):InspectionReminder[]{
 const visits=records.filter(r=>r.kind==='inspection'&&!r.archived&&r.data.status!=='Canceled'&&(includeTests||!r.data.test));const byId=new Map(visits.map(r=>[r.id,r]));
 const ancestry=new Map<string,string[]>();
 const ancestors=(r:InspectionRecord)=>{const cached=ancestry.get(r.id);if(cached)return cached;const ids:string[]=[],seen=new Set<string>([r.id]);let id=r.data.parentId;while(id&&!seen.has(id)){seen.add(id);ids.push(id);id=byId.get(id)?.data.parentId||'';}ancestry.set(r.id,ids);return ids;};
 const latestFollowUp=new Map<string,Map<string,InspectionRecord>>();
 for(const visit of visits){if(visit.data.status!=='Completed')continue;for(const parent of ancestors(visit)){let checks=latestFollowUp.get(parent);if(!checks){checks=new Map();latestFollowUp.set(parent,checks);}for(const check of visit.data.checks){const previous=checks.get(check.id);if(!previous||visit.updatedAt>previous.updatedAt)checks.set(check.id,visit);}}}
 const reminders:InspectionReminder[]=[];
 for(const r of visits){
  for(const c of r.data.checks.filter(c=>c.result==='Needs attention')){
   // The original report remains immutable; completed follow-up observations resolve its notices.
   const later=latestFollowUp.get(r.id)?.get(c.id);
   const latest=later?.data.checks.find(x=>x.id===c.id);if(latest&&['Acceptable','Corrected on site','Not applicable'].includes(latest.result))continue;
   if(ancestors(r).some(id=>byId.get(id)?.data.checks.some(x=>x.id===c.id&&x.result==='Needs attention')))continue;
   const finding=latest?.result==='Needs attention'?latest:c,source=latest?.result==='Needs attention'&&later?later:r;
   reminders.push({id:r.id+':'+c.id,recordId:source.id,title:finding.label,property:source.data.title,dueDate:finding.dueDate,kind:'Correction',status:dueStatus(finding.dueDate,today)});
  }
  if(r.data.status!=='Completed'&&r.data.followUpKind){const date=r.data.scheduledDate||r.data.nextDueDate;reminders.push({id:r.id+':visit',recordId:r.id,title:r.data.type,property:r.data.title,dueDate:date,kind:r.data.followUpKind==='reinspection'?'Reinspection':'Routine visit',status:dueStatus(date,today)});}
 }
 return reminders.sort((a,b)=>(a.dueDate||'0000').localeCompare(b.dueDate||'0000')||a.id.localeCompare(b.id));
}
