import {ensureDatabase} from '../../../db/bootstrap';
import {permissionsForEmail} from '../../server-permissions';
import {loadHolidayCalendar,holidayCalendarKey} from '../../payroll-holidays-server';
import {normalizePayrollHolidays,validHolidayYear,type HolidayCalendar} from '../../payroll-holidays';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
async function viewer(request:Request,db:Awaited<ReturnType<typeof ensureDatabase>>){
 const email=request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();if(!email||!request.headers.get('x-department-id'))throw Error('VERIFIED_SESSION');
 const permissions=await permissionsForEmail(email,db);
 const employee=await db.prepare('SELECT COALESCE(ep.is_admin,0) AS isAdmin FROM employees e JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND e.id=employee_id_for_login(?) LIMIT 1').bind(email).first<{isAdmin:number}>();
 return{email,canManage:permissions.has('payroll.manage')&&(email==='bobff353@gmail.com'||Boolean(employee?.isAdmin))};
}
export async function GET(request:Request){const selectedYear=Number(new URL(request.url).searchParams.get('year'));if(!validHolidayYear(selectedYear))return json({error:'Choose a year from 1900 through 2199.'},400);try{const db=await ensureDatabase(),actor=await viewer(request,db),year=Number(new URL(request.url).searchParams.get('year'));return json({calendar:await loadHolidayCalendar(db,year),canManage:actor.canManage});}catch(e){return json({error:e instanceof Error&&e.message==='VERIFIED_SESSION'?'Verified department sign-in is required.':'The holiday calendar could not load. Saved dates have not changed.'},e instanceof Error&&e.message==='VERIFIED_SESSION'?401:503);}}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Open this action from the department portal.'},403);
 let writing=false;
 try{const db=await ensureDatabase(),actor=await viewer(request,db);if(!actor.canManage)return json({error:'Administrator and payroll management access are required to change holidays.'},403);
 const raw=await request.text();if(raw.length>24000)return json({error:'The holiday calendar is too large.'},413);const body=JSON.parse(raw),year=Number(body.year),version=Number(body.version);
 if(!validHolidayYear(year)||!Number.isSafeInteger(version)||version<0)return json({error:'Choose a valid year and reload its saved calendar.'},400);
 const current=await loadHolidayCalendar(db,year),holidays=normalizePayrollHolidays(body.holidays,year);
 if(current.version===version+1&&JSON.stringify(current.holidays)===JSON.stringify(holidays))return json({saved:true,calendar:current});
 if(current.version!==version)return json({error:'Another administrator changed this calendar. Your edits remain here. Reload the saved dates before retrying.'},409);
 const dates=new Set([...current.holidays,...holidays].filter(h=>!current.holidays.some(c=>JSON.stringify(c)===JSON.stringify(h))||!holidays.some(c=>JSON.stringify(c)===JSON.stringify(h))).map(h=>h.date));
 for(const date of dates){const closed=await db.prepare("SELECT start_date FROM pay_periods WHERE status='finalized' AND start_date<=? AND end_date>=? LIMIT 1").bind(date,date).first();if(closed)return json({error:`${date} is in finalized payroll. Keep its holiday setting unchanged; use the existing payroll correction workflow.`},423);}
 const saved:HolidayCalendar={year,version:version+1,holidays,updatedBy:actor.email,updatedAt:new Date().toISOString(),configured:true},key=holidayCalendarKey(year);
 const existing=await db.prepare('SELECT value FROM system_meta WHERE key=?').bind(key).first<{value:string}>();
 if(existing&&JSON.parse(existing.value).version!==version)return json({error:'Another administrator changed this calendar. Reload before retrying.'},409);
 const dateValues=[...dates].flatMap(date=>[date,date]);
 const guard=dates.size?" AND NOT EXISTS (SELECT 1 FROM pay_periods WHERE status='finalized' AND ("+[...dates].map(()=>'(start_date<=? AND end_date>=?)').join(' OR ')+"))":'';
 const write=existing?db.prepare('UPDATE system_meta SET value=?,updated_at=CURRENT_TIMESTAMP WHERE key=? AND value=?'+guard).bind(JSON.stringify(saved),key,existing.value,...dateValues).expectChanges(1):db.prepare('INSERT INTO system_meta(key,value,updated_at) SELECT ?,?,CURRENT_TIMESTAMP WHERE 1=1'+guard).bind(key,JSON.stringify(saved),...dateValues).expectChanges(1);
 // Lock the shared payroll source version before changing calendar inputs.
 writing=true;await db.batch([db.prepare('UPDATE payroll_source_version SET version=version+1 WHERE id=1').expectChanges(1),write,db.prepare("INSERT INTO record_revisions(id,record_type,record_id,revision_number,action,summary,actor) VALUES(?,'payroll-holidays',?,?,'Holiday calendar saved',?,?)").bind(crypto.randomUUID(),key,saved.version,JSON.stringify({before:current.holidays,after:holidays}),actor.email)]);
 return json({saved:true,calendar:saved});
 }catch(e){const message=e instanceof Error?e.message:'';if(message==='VERIFIED_SESSION')return json({error:'Verified department sign-in is required.'},401);if(/SAVE_CONFLICT|duplicate key/.test(message))return json({error:'Another save reached the server first. Your edits remain here; reload before retrying.'},409);return json({error:writing||/Portal database|fetch/.test(message)?'Save was not confirmed. Keep your edits and retry.':message||'The calendar was not saved.'},writing||/Portal database|fetch/.test(message)?503:400);}
}
