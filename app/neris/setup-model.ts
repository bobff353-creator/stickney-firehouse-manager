export const setupTasks = [
  {id:'profile', title:'Department profile', hint:'Confirm demographics, services, boundaries and aid relationships in the official profile.'},
  {id:'administrators', title:'Administrator continuity', hint:'Designate the lead and backup administrators; confirm their access in NERIS.'},
  {id:'apparatus', title:'Stations & units', hint:'Review the department’s stations and apparatus inventory.'},
  {id:'enrollment', title:'Reporting integration', hint:'Confirm the approved reporting vendor and its department enrollment.'},
  {id:'transition', title:'Illinois transition notice', hint:'Notify OSFM of the actual date live NERIS reporting starts.'},
  {id:'counts', title:'Reporting counts', hint:'Compare accepted reports with the monthly Illinois compliance report.'},
  {id:'retention', title:'Records retention', hint:'Review retention requirements with the department’s legal counsel.'},
] as const;
export type SetupTask = typeof setupTasks[number]['id'];
export const taskStatuses = ['Not started','In progress','Confirmed'] as const;
export const reportingMethods = ['','ESO','First Due','NERIS portal','Other reporting system','Not decided'] as const;
export const dispatchChoices = ['','Undecided','Discuss with CAD provider','Plan to share','Do not plan to share'] as const;
export type ReportingSetup = {
  departmentId:string; departmentConfirmed:boolean; reportingMethod:typeof reportingMethods[number];
  otherSystem:string; leadId:string; backupId:string; dispatchPlan:typeof dispatchChoices[number];
  tasks:Record<SetupTask,typeof taskStatuses[number]>; notes:string;
};
export function emptySetup():ReportingSetup {
  return {departmentId:'',departmentConfirmed:false,reportingMethod:'',otherSystem:'',leadId:'',backupId:'',dispatchPlan:'',
    tasks:Object.fromEntries(setupTasks.map(t=>[t.id,'Not started'])) as ReportingSetup['tasks'],notes:''};
}
export function validateSetup(value:unknown):asserts value is ReportingSetup {
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Department setup must be an object.');
  const s=value as ReportingSetup;
  if(typeof s.departmentConfirmed!=='boolean'||!reportingMethods.includes(s.reportingMethod)||!dispatchChoices.includes(s.dispatchPlan))throw Error('Choose valid department reporting options.');
  for(const key of ['departmentId','otherSystem','leadId','backupId','notes'] as const)if(typeof s[key]!=='string'||s[key].length>(key==='notes'?5000:200))throw Error('A department setup field is invalid or too long.');
  if(s.departmentId&&!/^FD\d{8}$/.test(s.departmentId))throw Error('Enter a department NERIS ID in the format FD followed by eight digits.');
  if(s.departmentConfirmed&&!s.departmentId)throw Error('Choose a department before confirming its identity.');
  if(s.leadId&&s.leadId===s.backupId)throw Error('Choose a different backup administrator.');
  if(!s.tasks||typeof s.tasks!=='object'||Array.isArray(s.tasks)||setupTasks.some(t=>!taskStatuses.includes(s.tasks[t.id])))throw Error('Choose a valid status for each setup item.');
}
