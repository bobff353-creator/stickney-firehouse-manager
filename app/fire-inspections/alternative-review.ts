export const alternativeReviewSource='https://link.nfpa.org/free-access/publications/101a/2025';
export const reviewOccupancies=['Business','Educational','Health care','Residential board and care','Detention and correctional'] as const;
export const reviewStatuses=['Draft','Submitted for review','Approved','Revisions needed','Not pursued'] as const;
export type ReviewTask={id:string;title:string;responsible:string;dueDate:string;status:'Open'|'Done'|'Not needed';completedDate:string;notes:string};
export type AlternativeReview={enabled:boolean;occupancy:string;guideEdition:string;codeEdition:string;authority:string;scope:string;issue:string;proposal:string;preparedBy:string;evidenceNotes:string;basisConfirmed:boolean;status:typeof reviewStatuses[number];submittedDate:string;decisionDate:string;decisionBy:string;decisionReference:string;decisionNotes:string;conditions:string;decisionConfirmed:boolean;nextReviewDate:string;tasks:ReviewTask[]};
export function emptyAlternativeReview():AlternativeReview{return{enabled:false,occupancy:'',guideEdition:'',codeEdition:'',authority:'',scope:'',issue:'',proposal:'',preparedBy:'',evidenceNotes:'',basisConfirmed:false,status:'Draft',submittedDate:'',decisionDate:'',decisionBy:'',decisionReference:'',decisionNotes:'',conditions:'',decisionConfirmed:false,nextReviewDate:'',tasks:[]};}
const text=(v:unknown,max=2500)=>String(v??'').trim().slice(0,max);
const date=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const basisKeys=['occupancy','guideEdition','codeEdition','authority','scope','issue','proposal','preparedBy','evidenceNotes','basisConfirmed'] as const;
export function reviewBasis(r:AlternativeReview){return JSON.stringify(basisKeys.map(k=>r[k]));}
export function restartAlternativeReview(r:AlternativeReview):AlternativeReview{return{...r,status:'Draft',submittedDate:'',decisionDate:'',decisionBy:'',decisionReference:'',decisionNotes:'',conditions:'',decisionConfirmed:false};}
export function updateAlternativeReview<K extends keyof AlternativeReview>(r:AlternativeReview,key:K,value:AlternativeReview[K]):AlternativeReview{
 let next={...r,[key]:value};
 if(key==='status'&&value==='Draft')return restartAlternativeReview(next);
 if(['guideEdition','codeEdition','authority','occupancy','scope'].includes(key)&&r[key]!==value)next.basisConfirmed=false;
 if(key==='status'&&value==='Submitted for review')next={...next,decisionDate:'',decisionBy:'',decisionReference:'',decisionNotes:'',conditions:'',decisionConfirmed:false};
 if(basisKeys.some(k=>k===key)&&r[key]!==value&&r.status!=='Draft')next=restartAlternativeReview(next);
 if(['status','decisionDate','decisionBy','decisionReference','decisionNotes','conditions'].includes(key)&&r[key]!==value)next.decisionConfirmed=false;
 return next;
}
export function normalizeAlternativeReview(value:unknown):AlternativeReview{
 if(value==null)return emptyAlternativeReview();
 if(typeof value!=='object'||Array.isArray(value))throw Error('Alternative review details are invalid.');
 const v=value as Record<string,unknown>,r=emptyAlternativeReview();
 for(const k of Object.keys(r) as (keyof AlternativeReview)[])if(typeof r[k]==='string')(r as unknown as Record<string,unknown>)[k]=text(v[k]);
 r.enabled=v.enabled===true;r.basisConfirmed=v.basisConfirmed===true;r.decisionConfirmed=v.decisionConfirmed===true;
 if(!reviewStatuses.includes(r.status))throw Error('Choose a valid alternative review status.');
 if(r.occupancy&&!reviewOccupancies.includes(r.occupancy as typeof reviewOccupancies[number]))throw Error('Choose an occupancy covered by this review guide.');
 if(v.tasks!=null&&(!Array.isArray(v.tasks)||v.tasks.length>50))throw Error('Use up to 50 alternative review follow-up checks.');
 r.tasks=(Array.isArray(v.tasks)?v.tasks:[]).map(t=>{if(!t||typeof t!=='object')throw Error('Invalid review follow-up check.');const task={id:text(t.id,100),title:text(t.title,240),responsible:text(t.responsible,200),dueDate:text(t.dueDate,10),status:text(t.status,30) as ReviewTask['status'],completedDate:text(t.completedDate,10),notes:text(t.notes)};if(!task.id||!task.title||!['Open','Done','Not needed'].includes(task.status))throw Error('Each review check needs a name and valid status.');return task;});
 if(new Set(r.tasks.map(t=>t.id)).size!==r.tasks.length)throw Error('Duplicate review follow-up checks are not allowed.');
 return r;
}
export function validateAlternativeReview(r:AlternativeReview,today:string){
 for(const s of [r.submittedDate,r.decisionDate,r.nextReviewDate,...r.tasks.flatMap(t=>[t.dueDate,t.completedDate])])if(s&&!date(s))throw Error('Use valid calendar dates in the alternative review.');
 if(r.submittedDate>today||r.decisionDate>today||r.tasks.some(t=>t.completedDate>today))throw Error('Recorded review events cannot be dated in the future.');
 if(r.submittedDate&&r.decisionDate&&r.decisionDate<r.submittedDate)throw Error('The authority decision cannot precede submission.');
 if(!r.enabled)return;
 for(const t of r.tasks){if(t.status==='Done'&&!t.completedDate)throw Error(`Record when ${t.title} was completed.`);if(t.status==='Not needed'&&!t.notes)throw Error(`Explain why ${t.title} is not needed.`);}
 if(r.status==='Draft'){if(r.decisionConfirmed||r.decisionDate||r.decisionBy||r.decisionReference)throw Error('A draft cannot retain an earlier authority decision. Restart the review so the old decision remains only in history.');return;}
 if(r.status==='Not pursued'){if(!r.decisionNotes)throw Error('Record why the alternative review is not being pursued.');return;}
 if(!r.occupancy||!r.scope||!r.issue||!r.proposal||!r.authority||!r.preparedBy||!r.evidenceNotes)throw Error('Before recording submission, complete the occupancy, scope, issue, proposal, authority, preparer, and evidence summary.');
 if(!/^\d{4}$/.test(r.guideEdition)||!/^\d{4}$/.test(r.codeEdition)||!r.basisConfirmed)throw Error('Confirm the guide/code editions and the authority’s acceptance of the review method.');
 if(r.guideEdition==='2025'&&r.codeEdition!=='2024')throw Error('NFPA 101A 2025 evaluates against NFPA 101 2024. Verify the correct guide for a different code edition.');
 if(!r.submittedDate)throw Error('Record the actual submission date. Saving here does not send the review.');
 if(['Approved','Revisions needed'].includes(r.status)&&(!r.decisionDate||!r.decisionBy||!r.decisionReference||!r.decisionNotes||!r.decisionConfirmed))throw Error('Record the authority, date, decision document/reference, decision notes, and confirmation of the actual decision.');
}
export function reviewDueLabel(value:string,today:string){if(!value)return 'Needs a date';const days=Math.round((Date.parse(value)-Date.parse(today))/86400000);return days<0?'Past due':days===0?'Due today':days<=7?'Due within 1 week':days<=14?'Due within 2 weeks':'Upcoming';}
export function reviewFollowUps(r:AlternativeReview){if(!r.enabled||r.status==='Not pursued')return [];return[...(r.nextReviewDate?[{id:'review-date',title:'Review the alternative safety arrangement',responsible:r.preparedBy,dueDate:r.nextReviewDate}]:[]),...r.tasks.filter(t=>t.status==='Open')];}
export function alternativeReviewLines(r:AlternativeReview):string[]{if(!r.enabled)return [];return[
 'Alternative Safety Review — NFPA 101A',`Recorded review status: ${r.status}. This records an external review; it does not grant approval or clear inspection findings.`,
 `Occupancy: ${r.occupancy||'Not selected'} · Scope / zones: ${r.scope||'Not recorded'}`,
 `Guide: NFPA 101A ${r.guideEdition||'Not selected'} · Code: NFPA 101 ${r.codeEdition||'Not selected'}`,
 `Authority: ${r.authority||'Not recorded'} · Method / editions confirmed: ${r.basisConfirmed?'Yes':'No'}`,
 `Issue / requirement: ${r.issue||'Not recorded'}`,`Proposed alternative: ${r.proposal||'Not recorded'}`,`Prepared by: ${r.preparedBy||'Not recorded'}`,
 `Evidence summary: ${r.evidenceNotes||'Not recorded'}`,`Submitted externally: ${r.submittedDate||'Not recorded'}`,
 `Authority decision: ${r.decisionBy||'Not recorded'} · ${r.decisionDate||'Date not recorded'}`,
 `Decision reference: ${r.decisionReference||'Not recorded'}`,`Decision notes: ${r.decisionNotes||'Not recorded'}`,`Decision confirmed as received: ${r.decisionConfirmed?'Yes':'No'}`,`Approval conditions: ${r.conditions||'Not recorded'}`,
 `Next review: ${r.nextReviewDate||'Not set'}`,...r.tasks.map(t=>`${t.title} — ${t.status}\nResponsible: ${t.responsible||'Not assigned'} · Due: ${t.dueDate||'Not set'} · Completed: ${t.completedDate||'Not recorded'}\n${t.notes}`),
 `Reference guide: ${alternativeReviewSource}. NFPA 101A 2025 is paired with NFPA 101 2024. Use the applicable official worksheets. No FSES score is calculated by this app.`
 ];}
