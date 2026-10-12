import type {ensureDatabase} from '../db/bootstrap';
import {defaultHolidayCalendar,normalizePayrollHolidays,validHolidayYear,type HolidayCalendar} from './payroll-holidays';
type Database=Awaited<ReturnType<typeof ensureDatabase>>;
export const holidayCalendarKey=(year:number)=>`payroll-holidays:${year}`;
export async function loadHolidayCalendar(db:Database,year:number):Promise<HolidayCalendar>{
 if(!validHolidayYear(year))throw Error('Choose a year from 1900 through 2199.');
 const row=await db.prepare('SELECT value FROM system_meta WHERE key=?').bind(holidayCalendarKey(year)).first<{value:string}>();
 if(!row)return defaultHolidayCalendar(year);
 const value=JSON.parse(row.value);if(value.year!==year||!Number.isSafeInteger(value.version)||value.version<1)throw Error('The saved holiday calendar is invalid. Contact an administrator; no dates were assumed.');
 return{year,version:value.version,holidays:normalizePayrollHolidays(value.holidays,year),updatedBy:String(value.updatedBy||''),updatedAt:String(value.updatedAt||''),configured:true};
}
export async function holidayForPayrollDate(db:Database,date:string){return(await loadHolidayCalendar(db,Number(date.slice(0,4)))).holidays.find(h=>h.date===date)||null;}
