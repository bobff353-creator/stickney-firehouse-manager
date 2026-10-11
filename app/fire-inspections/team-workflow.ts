export type InspectionIdentity={id:string;name:string;email:string};
export type InspectionTeam={assignees:{id:string;role:'Lead'|'Assisting'}[];reviewerId:string;required:boolean;state:'Not requested'|'Draft'|'Submitted'|'Changes requested'|'Approved';notes:string;actedBy:string;actedAt:string};
export const ownerIdentityId='pilot-owner';
export function emptyTeam():InspectionTeam{return{assignees:[],reviewerId:'',required:false,state:'Not requested',notes:'',actedBy:'',actedAt:''};}
export function normalizeTeam(value:unknown):InspectionTeam{
 if(value==null)return emptyTeam();if(typeof value!=='object'||Array.isArray(value))throw Error('Invalid inspection assignment.');const v=value as Partial<InspectionTeam>,next=emptyTeam();
 if(!Array.isArray(v.assignees)||v.assignees.length>12)throw Error('Assign up to 12 inspectors.');
 next.assignees=v.assignees.map(a=>{if(!a||typeof a.id!=='string'||a.id.length>120||!['Lead','Assisting'].includes(a.role))throw Error('Choose an existing inspector and role.');return{id:a.id,role:a.role};});
 if(new Set(next.assignees.map(a=>a.id)).size!==next.assignees.length||next.assignees.filter(a=>a.role==='Lead').length>1)throw Error('Assign each inspector once, with one lead.');
 next.reviewerId=String(v.reviewerId||'').slice(0,120);next.required=v.required===true;next.state=v.state||'Not requested';
 if(!['Not requested','Draft','Submitted','Changes requested','Approved'].includes(next.state))throw Error('Choose a valid inspection review state.');
 next.notes=String(v.notes||'').trim().slice(0,4000);next.actedBy=String(v.actedBy||'').slice(0,254);next.actedAt=String(v.actedAt||'').slice(0,50);return next;
}
export function reviewBasis(data:object){const d={...data} as Record<string,unknown>;for(const key of ['team','status','representative','inspectorSignature','inspectorAttested','changeReason'])delete d[key];return JSON.stringify(d);}
export function reviewTransition(current:InspectionTeam,next:InspectionTeam,actor:string,reviewerEmail:string,time:string,basisChanged:boolean):InspectionTeam{
 const assignmentChanged=JSON.stringify(current.assignees)!==JSON.stringify(next.assignees)||current.reviewerId!==next.reviewerId||current.required!==next.required;
 if(['Approved','Changes requested'].includes(next.state)&&next.state!==current.state){
  if(current.state!=='Submitted'||basisChanged||assignmentChanged)throw Error('Save and submit the current inspection before recording a review decision.');
  if(actor!==reviewerEmail)throw Error('Only the assigned, authorized reviewer can record this decision. Other employee access remains disabled.');
  if(next.state==='Changes requested'&&!next.notes)throw Error('Explain the corrections requested.');
  return{...next,actedBy:actor,actedAt:time};
 }
 if((basisChanged||assignmentChanged)&&['Submitted','Approved','Changes requested'].includes(current.state))return{...next,state:'Draft',actedBy:'',actedAt:''};
 if(next.state==='Submitted'&&current.state!=='Submitted'){
  if(!next.reviewerId||next.assignees.filter(a=>a.role==='Lead').length!==1)throw Error('Choose a lead inspector and reviewer before submitting.');
  return{...next,actedBy:actor,actedAt:time};
 }
 if(next.state==='Approved'&&current.state!=='Approved')throw Error('Submit this inspection before approval.');
 if(next.state===current.state&&['Approved','Changes requested'].includes(current.state)&&next.notes!==current.notes)throw Error('Submit a new review before changing its recorded decision notes.');
 if(next.state==='Draft'&&current.state!=='Draft')return{...next,actedBy:'',actedAt:''};
 return{...next,actedBy:current.actedBy,actedAt:current.actedAt};
}
