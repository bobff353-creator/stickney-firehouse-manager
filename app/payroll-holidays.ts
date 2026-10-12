import {departmentHolidays,type DepartmentHoliday} from './holidays.ts';
export type PayrollHoliday=DepartmentHoliday&{id:string;presetId:string};
export type HolidayCalendar={year:number;version:number;holidays:PayrollHoliday[];updatedBy:string;updatedAt:string;configured:boolean};
export const holidayPresetNames=["New Year's Day","Martin Luther King Day","Presidents’ Day","Easter","Memorial Day","Juneteenth","Independence Day","Labor Day","Columbus Day","Veteran's Day","Thanksgiving","Christmas Eve (Night shift only)","Christmas Day"] as const;
export const holidayPresetIds=['new-year','martin-luther-king','presidents','easter','memorial','juneteenth','independence','labor','columbus','veterans','thanksgiving','christmas-eve','christmas'] as const;
export function validHolidayYear(year:number){return Number.isInteger(year)&&year>=1900&&year<=2199;}
export function validHolidayDate(date:string){return /^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date+'T12:00:00Z'))&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date;}
export function holidayPresets(year:number):PayrollHoliday[]{if(!validHolidayYear(year))throw Error('Choose a year from 1900 through 2199.');return departmentHolidays(year).map((h,i)=>({...h,name:holidayPresetNames[i],id:holidayPresetIds[i]+'-'+year,presetId:holidayPresetIds[i]}));}
export function defaultHolidayCalendar(year:number):HolidayCalendar{return{year,version:0,holidays:normalizePayrollHolidays(departmentHolidays(year).map((h,i)=>({...h,id:holidayPresetIds[i]+'-'+year,presetId:holidayPresetIds[i]})),year),updatedBy:'',updatedAt:'',configured:false};}
export function normalizePayrollHolidays(value:unknown,year:number):PayrollHoliday[]{
 if(!validHolidayYear(year)||!Array.isArray(value)||value.length>80)throw Error('Choose a valid holiday year and up to 80 dates.');
 const ids=new Set<string>(),dates=new Set<string>(),names=new Set<string>(),presets=new Set<string>();
 return value.map(raw=>{if(!raw||typeof raw!=='object')throw Error('Each holiday needs a name and date.');const id=String(raw.id||''),name=String(raw.name||'').trim(),date=String(raw.date||''),presetId=String(raw.presetId||'');
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id)||!name||name.length>100||!validHolidayDate(date)||Number(date.slice(0,4))!==year)throw Error('Each holiday needs a unique ID, name, and real date in the selected year.');
  if(presetId&&!holidayPresetIds.includes(presetId as typeof holidayPresetIds[number]))throw Error('Choose a known holiday preset or a custom date.');
  const normalizedName=name.toLocaleLowerCase('en-US').replace(/[’']/g,'').replace(/\s+/g,' ');
  if(ids.has(id)||dates.has(date)||names.has(normalizedName)||(presetId&&presets.has(presetId)))throw Error('This holiday or date is already selected. Edit the existing entry instead.');ids.add(id);dates.add(date);names.add(normalizedName);if(presetId)presets.add(presetId);
  const overnightOnly=raw.overnightOnly===true;
  if((presetId==='christmas-eve'||normalizedName.startsWith('christmas eve'))&&!overnightOnly)throw Error('Christmas Eve is night shift only: 6 p.m. through 6 a.m.');
  if(overnightOnly&&presetId!=='christmas-eve'&&!normalizedName.startsWith('christmas eve'))throw Error('Only the confirmed Christmas Eve preset has a night-shift window.');
  return{id,name,date,presetId,...(overnightOnly?{overnightOnly:true,note:'Night shift only · 6 p.m.–6 a.m.',windowStart:'18:00',windowEnd:'06:00'}:{})};
 }).sort((a,b)=>a.date.localeCompare(b.date));
}
export function calendarHolidayForDate(date:string,calendars:HolidayCalendar[]){return calendars.find(c=>c.year===Number(date.slice(0,4)))?.holidays.find(h=>h.date===date)||null;}
