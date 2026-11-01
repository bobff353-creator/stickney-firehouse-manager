export const drugModes = ['medication','pass_fail','quantity','expiration_date','numeric','mileage','text'] as const;
export type DrugSchema = {version:1;title:string;mode:typeof drugModes[number];expectedQuantity:number;location:string};
export type DrugResponse = {condition:string;count:string;expirations:string[];locations:string[];value:string;notes:string};
export const emptyDrugResponse = (): DrugResponse => ({condition:'',count:'',expirations:[],locations:[],value:'',notes:''});
function object(value: unknown): Record<string,unknown> | null {
  try {const parsed=typeof value==='string'?JSON.parse(value):value;return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:null;}catch{return null;}
}
export function drugSchema(value: unknown): DrugSchema | null {
  const schema=object(value);
  return schema?.version===1&&typeof schema.title==='string'&&drugModes.includes(schema.mode as DrugSchema['mode'])&&Number.isInteger(schema.expectedQuantity)&&Number(schema.expectedQuantity)>0&&Number(schema.expectedQuantity)<=100&&typeof schema.location==='string'?schema as DrugSchema:null;
}
export function drugResponse(value: unknown): DrugResponse {
  const source=object(value),response=emptyDrugResponse();
  for(const key of ['condition','count','value','notes'] as const)response[key]=typeof source?.[key]==='string'?source[key]:'';
  response.expirations=Array.isArray(source?.expirations)?source.expirations.filter((date:unknown)=>typeof date==='string'):[];
  response.locations=Array.isArray(source?.locations)?source.locations.filter((location:unknown)=>typeof location==='string'):[];
  return response;
}
export function validDrugDate(value: string): boolean {
  const date=new Date(value+'T12:00:00Z');
  return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function drugIssues(schema: DrugSchema,response: DrugResponse,today:string): string[] {
  const issues=response.condition==='issue'?['An issue was reported']:[];
  if(response.condition==='not_applicable')return [];
  if(['medication','quantity'].includes(schema.mode)&&/^\d+$/.test(response.count)&&Number(response.count)<schema.expectedQuantity)issues.push(`Count ${response.count}; required ${schema.expectedQuantity}`);
  if(schema.mode==='medication')response.locations.forEach((location,index)=>{if(location.trim()&&location.trim().toLowerCase()!==schema.location.trim().toLowerCase())issues.push(`Container ${index+1}: observed at a different location`);});
  const dates=schema.mode==='medication'?response.expirations:schema.mode==='expiration_date'?[response.value]:[];
  dates.forEach((date,index)=>{if(date==='unknown')issues.push(`Container ${index+1}: expiration could not be verified`);else if(validDrugDate(date)&&date<today)issues.push(`Container ${index+1}: expired ${date}`);});
  return issues;
}
export function drugErrors(schema:DrugSchema,response:DrugResponse,today:string,complete=true):string[]{
  const errors:string[]=[];
  if(response.condition&&!['satisfactory','issue','not_applicable'].includes(response.condition))errors.push('Choose a valid observed result.');
  if(response.count&&(!/^\d{1,3}$/.test(response.count)||Number(response.count)>100))errors.push('Enter a whole count from 0 to 100.');
  if(response.expirations.length>100||response.expirations.some(date=>date!==''&&date!=='unknown'&&!validDrugDate(date)))errors.push('Enter valid expiration dates or mark them unable to verify.');
  if(['numeric','mileage'].includes(schema.mode)&&response.value&&(!/^(\d+(\.\d*)?|\.\d+)$/.test(response.value)||!Number.isFinite(Number(response.value))||Number(response.value)<0))errors.push('Enter a nonnegative decimal reading.');
  if(schema.mode==='expiration_date'&&response.value&&response.value!=='unknown'&&!validDrugDate(response.value))errors.push('Enter a valid expiration date.');
  if(response.notes.length>4000||response.locations.length>100||response.locations.some(location=>location.length>240)||response.value.length>4000)errors.push('An entry is too long.');
  if(!complete)return errors;
  if(!response.condition)errors.push('Choose the observed result.');
  if(response.condition==='satisfactory'){
    if(['medication','quantity'].includes(schema.mode)&&response.count==='')errors.push('Enter the actual quantity counted.');
    if(schema.mode==='medication'){
      if(response.locations.length!==Number(response.count)||response.locations.some(location=>!location.trim()))errors.push('Record the observed location for each container present.');
      if(response.expirations.length!==Number(response.count)||response.expirations.some(date=>!date))errors.push('Record an expiration date for every container present, or mark unable to verify.');
    }
    if(['numeric','mileage','text','expiration_date'].includes(schema.mode)&&!response.value.trim())errors.push('Record the required reading.');
  }
  if((response.condition==='not_applicable'||drugIssues(schema,response,today).length)&&!response.notes.trim())errors.push('Explain the issue or why this item does not apply.');
  return errors;
}
export function drugSummary(schema:DrugSchema,response:DrugResponse):string{
  return [schema.title,`Observed result: ${response.condition.replaceAll('_',' ')||'Not recorded'}`,
    ['medication','quantity'].includes(schema.mode)?`Quantity counted: ${response.count||'Not recorded'}; required ${schema.expectedQuantity}`:'',
    ...(schema.mode==='medication'?response.expirations.map((date,index)=>`Container ${index+1} expiration: ${date==='unknown'?'Unable to verify':date||'Not recorded'}`):[]),
    ...(schema.mode==='medication'?response.locations.map((location,index)=>`Container ${index+1} observed location: ${location||'Not recorded'}`):[]),
    ['numeric','mileage','text','expiration_date'].includes(schema.mode)?`Reading: ${response.value==='unknown'?'Unable to verify':response.value||'Not recorded'}`:'',
    response.notes.trim()?`Comments: ${response.notes.trim()}`:''].filter(Boolean).join('\n');
}
