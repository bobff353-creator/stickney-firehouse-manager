/** A selected person with no positive attendance has not completed the assignment. */
export function completedMemberIds(record:{kind:string;archived?:boolean|number;data:{status?:unknown;test?:unknown;employeeIds?:unknown;hours?:unknown;attendance?:unknown}}):string[]{
 if(record.kind!=='completion'||record.archived||record.data.test===true||record.data.status!=='completed'||!Array.isArray(record.data.employeeIds))return [];
 const attendance=record.data.attendance&&typeof record.data.attendance==='object'?record.data.attendance as Record<string,unknown>:{};
 return record.data.employeeIds.filter((id):id is string=>{const hours=attendance[id]??record.data.hours;return typeof id==='string'&&typeof hours==='number'&&Number.isFinite(hours)&&hours>0;});
}
