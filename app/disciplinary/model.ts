export const disciplineSteps=['Verbal Counseling, Non-documented','Verbal Counseling, Documented','Written Reprimand','Suspension','Termination'] as const;
export const priorDiscipline=['No','Yes, unrelated','Yes, related'] as const;
export const contributingFactors=['Failure to adhere to policy','Failure to follow instruction','Operating without authority','Impairment/Unfit for Duty','Unsafe procedure or process','Uniform, Dress Code Violation','AWOL/No Call/No Show','AWOL/Call Off','Dereliction of Duty','Insubordination','Other, See Details'] as const;
export const documentationOptions=['Yes, in print','Yes, electronically','No'] as const;
export const signatureLabels={employee:'Employee signature',witness:'Local 700 witness signature',supervisor:'Supervisor signature',chief:'Chief approval'} as const;
export type SignatureKey=keyof typeof signatureLabels;
export type ReportSignature={name:string;image:string;recordedAt?:string;recordedBy?:string};
export type DisciplinaryContent={schemaVersion:1;employeeId:string;employeeName?:string;supervisorId:string;supervisorName?:string;incidentDate:string;incidentTime:string;incidentNumber:string;disciplineStep:string;previousDiscipline:string;factors:string[];details:string;correctiveActions:string;documentationProvided:string;employeeResponse:string;employeeComments:string;fileIds:string[];signatures:Partial<Record<SignatureKey,ReportSignature>>};
export type DisciplinaryReport={id:string;department_id:string;content:DisciplinaryContent;status:'draft'|'submitted';version:number;change_reason:string;created_at:string;updated_at:string;submitted_at:string|null;created_by_name:string;updated_by_name:string;last_operation_id:string};
export type DisciplinaryVersion={report_id:string;version:number;content:DisciplinaryContent;status:'draft'|'submitted';change_reason:string;actor_name:string;saved_at:string};
export type DisciplinaryFile={id:string;report_id:string;original_filename:string;mime_type:string;byte_size:number;uploaded_at:string;uploaded_by_name:string;sha256:string};
export type DisciplinaryPerson={id:string;name:string;rank:string;active:boolean};
export const blankDisciplinaryContent=():DisciplinaryContent=>({schemaVersion:1,employeeId:'',supervisorId:'',incidentDate:'',incidentTime:'',incidentNumber:'',disciplineStep:'',previousDiscipline:'',factors:[],details:'',correctiveActions:'',documentationProvided:'',employeeResponse:'',employeeComments:'',fileIds:[],signatures:{}});
export const disciplinaryToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function disciplinaryErrors(content:DisciplinaryContent,complete:boolean,today=disciplinaryToday()):string[]{
  const errors:string[]=[];
  const date=new Date(content.incidentDate+'T12:00:00Z');
  if(content.incidentDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(content.incidentDate)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==content.incidentDate||content.incidentDate>today))errors.push('Enter the actual incident date, today or earlier.');
  if(content.incidentTime&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(content.incidentTime))errors.push('Enter a valid incident time.');
  for(const [key,choices] of [['disciplineStep',disciplineSteps],['previousDiscipline',priorDiscipline],['documentationProvided',documentationOptions],['employeeResponse',['Yes','No']]] as const){if(content[key]&&!choices.some(value=>value===content[key]))errors.push('Choose a valid '+key.replace(/[A-Z]/g,letter=>' '+letter.toLowerCase())+'.');}
  if(content.factors.some(value=>!contributingFactors.some(choice=>choice===value)))errors.push('Choose valid contributing factors.');
  if(complete){for(const [key,label] of [['employeeId','employee'],['incidentDate','incident date'],['supervisorId','supervisor making the report'],['disciplineStep','discipline step taken'],['previousDiscipline','previous discipline response'],['details','additional details'],['documentationProvided','documentation provided response'],['employeeResponse',"employee’s own response"]] as const)if(!content[key].trim())errors.push('Enter the '+label+'.');}
  if(content.details.length>12000||content.correctiveActions.length>12000||content.employeeComments.length>12000||content.incidentNumber.length>160)errors.push('A report field exceeds its displayed length limit.');
  return errors;
}
export function disciplinaryDate(value:string|null){if(!value)return 'Not recorded';const date=new Date(value);return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',dateStyle:'medium',timeStyle:'short'}).format(date)+' Central':'Not recorded';}
export const disciplinaryFileTypes=new Set(['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain']);
export const disciplinaryFileLimit=4*1024*1024;
