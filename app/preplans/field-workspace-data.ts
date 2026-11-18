// Presentation helpers never remove or rewrite the stored source records.
export function operationalNotes(value:string){
 value=value.replace(/^FlowMSP source:.*$/gm,'').replace(/^Source required flow is an older FlowMSP value,.*$/gm,'');
 return [...new Set(value.replace(/Imported from FlowMSP on \d{4}-\d{2}-\d{2}; source export \d{4}-\d{2}-\d{2}\. Needs field verification\.\s*/gi,'').replace(/FlowMSP source ID:\s*[0-9a-f-]{36}\.\s*/gi,'').replace(/Original FlowMSP GPS coordinates retained; the provider-generated address is display-only\.\s*/gi,'').replace(/FlowMSP reported flow:\s*[\d,.]+ GPM \([A-Z]+\)\.\s*/gi,'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean))].join('\n');
}
export function recordedHydrantFlow(h:{reportedFlow?:number|null;flowTests:{availableFlow:number;testedAt:string}[];reportedFlowDate?:string|null}){
 const test=h.flowTests?.[0];
 if(test&&(!h.reportedFlowDate||Date.parse(test.testedAt)>=Date.parse(h.reportedFlowDate)))return test.availableFlow;
 return h.reportedFlow??null;
}
export function hydrantBodyColor(flow:number|null,out=false){return out?'#929a9b':flow===null?'#e3bc35':flow>=1500?'#3b9ddb':flow>=1000?'#5aaa5c':flow>=500?'#ed9a36':'#d95e4d';}
export const HYDRANT_PATH='M15 3h6v4h-6V3ZM10 14a8 8 0 0 1 16 0H10ZM9 14h18v5H9v-5Zm2 5h14v20h3v5H8v-5h3V19ZM4 22h7v11H4V22Zm21 0h7v11h-7V22ZM2 21h3v13H2V21Zm29 0h3v13h-3V21Z';
export function chicagoDay(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function captureCameraMove<T extends {latitude:number;longitude:number;locationConfirmed:boolean}>(form:T,point:{lat:number;lng:number}):T{
 return {...form,latitude:point.lat,longitude:point.lng,locationConfirmed:form.locationConfirmed&&Math.abs(form.latitude-point.lat)<1e-7&&Math.abs(form.longitude-point.lng)<1e-7};
}
export function serviceInput(body:Record<string,unknown>){
 const id=String(body.id??''),hydrantId=String(body.hydrantId??''),kind=String(body.kind??''),performedOn=String(body.performedOn??''),notes=String(body.notes??'').trim();
 const flowGpm=body.flowGpm===null||body.flowGpm===''||body.flowGpm===undefined?null:Number(body.flowGpm);
 if(!/^[\w-]{8,80}$/.test(id)||!hydrantId||hydrantId.length>80||!['maintenance','flow'].includes(kind))throw Error('Choose a hydrant and service action.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(performedOn)||!Number.isFinite(Date.parse(performedOn))||new Date(performedOn).toISOString().slice(0,10)!==performedOn||performedOn>chicagoDay())throw Error('Choose a valid work date, today or earlier.');
 if(notes.length>3000||kind==='maintenance'&&!notes)throw Error('Describe the work performed (up to 3,000 characters).');
 if(kind==='flow'&&(flowGpm===null||!Number.isFinite(flowGpm)||flowGpm<=0||flowGpm>100000))throw Error('Enter the recorded flow between 0 and 100,000 GPM.');
 return {id,hydrantId,kind,performedOn,notes,flowGpm:kind==='flow'?flowGpm:null};
}
