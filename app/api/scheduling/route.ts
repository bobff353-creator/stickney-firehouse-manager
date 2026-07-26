import { ensureDatabase } from "../../../db/bootstrap";

const ownerAdminEmails = ["bobff353@gmail.com"];
const iso = /^\d{4}-\d{2}-\d{2}$/, clock = /^\d{2}:\d{2}$/;
async function viewer(db: Awaited<ReturnType<typeof ensureDatabase>>, request: Request) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  const employee = email ? await db.prepare("SELECT e.id,e.name,COALESCE(ep.is_admin,0) isAdmin FROM employees e LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND lower(ep.email)=? LIMIT 1").bind(email).first<{id:string;name:string;isAdmin:number}>() : null;
  return { email, employeeId: employee?.id ?? null, name: employee?.name ?? (email || "Employee"), isAdmin: ownerAdminEmails.includes(email) || Boolean(employee?.isAdmin) };
}
const addDays = (value:string, count:number) => { const date=new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate()+count); return date.toISOString().slice(0,10); };
const spanDays = (a:string,b:string) => Math.floor((Date.parse(`${b}T12:00:00Z`)-Date.parse(`${a}T12:00:00Z`))/86400000);
async function notify(db: Awaited<ReturnType<typeof ensureDatabase>>, ids:string[], title:string, message:string) {
  for (const employeeId of [...new Set(ids)]) {
    const contact=await db.prepare("SELECT COALESCE(email,'') email,COALESCE(phone,'') phone FROM employee_profiles WHERE employee_id=?").bind(employeeId).first<{email:string;phone:string}>();
    await db.prepare("INSERT INTO schedule_notifications(id,employee_id,title,message,in_app,email,sms,delivery_status) VALUES(?,?,?,?,1,?,?,'queued')").bind(crypto.randomUUID(),employeeId,title,message,contact?.email?1:0,contact?.phone?1:0).run();
  }
}
async function admins(db: Awaited<ReturnType<typeof ensureDatabase>>) {
  const rows=await db.prepare("SELECT e.id FROM employees e LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND (ep.is_admin=1 OR lower(ep.email)='bobff353@gmail.com')").all<{id:string}>();
  return rows.results.map(r=>r.id);
}
export async function GET(request:Request) {
  try {
    const db=await ensureDatabase(), current=await viewer(db,request);
    if(!current.isAdmin&&!current.employeeId)return Response.json({error:"Your login is not connected to an employee record."},{status:403});
    const id=current.employeeId??"";
    const [employees,assignments,rotations,requests,notifications]=await Promise.all([
      db.prepare("SELECT e.id,e.name,p.label rank,COALESCE(ep.email,'') email,COALESCE(ep.phone,'') phone FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 ORDER BY e.name COLLATE NOCASE").all(),
      current.isAdmin?db.prepare("SELECT a.id,a.employee_id employeeId,e.name employeeName,a.work_date workDate,a.start_time startTime,a.end_time endTime,a.role,a.source,a.status,a.emergency,a.notes FROM schedule_assignments a LEFT JOIN employees e ON e.id=a.employee_id WHERE a.work_date>=date('now','-45 day') ORDER BY a.work_date,a.start_time").all():db.prepare("SELECT a.id,a.employee_id employeeId,e.name employeeName,a.work_date workDate,a.start_time startTime,a.end_time endTime,a.role,a.source,a.status,a.emergency,a.notes FROM schedule_assignments a LEFT JOIN employees e ON e.id=a.employee_id WHERE a.work_date>=date('now','-45 day') AND (a.employee_id=? OR a.status='open') ORDER BY a.work_date,a.start_time").bind(id).all(),
      db.prepare("SELECT r.id,r.name,r.start_date startDate,r.end_date endDate,r.start_time startTime,r.end_time endTime,r.cycle_days cycleDays,r.duty_days dutyDays,r.role,r.active,GROUP_CONCAT(e.name,', ') members FROM schedule_rotations r LEFT JOIN schedule_rotation_members m ON m.rotation_id=r.id LEFT JOIN employees e ON e.id=m.employee_id GROUP BY r.id ORDER BY r.active DESC,r.start_date DESC").all(),
      current.isAdmin?db.prepare("SELECT q.id,q.request_type requestType,q.employee_id employeeId,e.name employeeName,q.assignment_id assignmentId,q.target_employee_id targetEmployeeId,te.name targetEmployeeName,q.start_date startDate,q.end_date endDate,q.start_time startTime,q.end_time endTime,q.role,q.repeat_mode repeatMode,q.status,q.notes,q.reviewed_by reviewedBy,q.created_at createdAt FROM schedule_requests q JOIN employees e ON e.id=q.employee_id LEFT JOIN employees te ON te.id=q.target_employee_id ORDER BY CASE q.status WHEN 'pending' THEN 0 ELSE 1 END,q.created_at DESC LIMIT 150").all():db.prepare("SELECT q.id,q.request_type requestType,q.employee_id employeeId,e.name employeeName,q.assignment_id assignmentId,q.target_employee_id targetEmployeeId,te.name targetEmployeeName,q.start_date startDate,q.end_date endDate,q.start_time startTime,q.end_time endTime,q.role,q.repeat_mode repeatMode,q.status,q.notes,q.reviewed_by reviewedBy,q.created_at createdAt FROM schedule_requests q JOIN employees e ON e.id=q.employee_id LEFT JOIN employees te ON te.id=q.target_employee_id WHERE q.employee_id=? OR q.target_employee_id=? ORDER BY q.created_at DESC").bind(id,id).all(),
      id?db.prepare("SELECT id,title,message,email,sms,delivery_status deliveryStatus,read_at readAt,created_at createdAt FROM schedule_notifications WHERE employee_id=? ORDER BY created_at DESC LIMIT 50").bind(id).all():Promise.resolve({results:[]})
    ]);
    return Response.json({viewer:current,employees:employees.results,assignments:assignments.results,rotations:rotations.results,requests:requests.results,notifications:notifications.results});
  } catch(error){return Response.json({error:error instanceof Error?error.message:"Unable to load scheduling"},{status:500});}
}
export async function POST(request:Request) {
  try {
    const db=await ensureDatabase(),current=await viewer(db,request),p=await request.json() as Record<string,unknown>,action=String(p.action??"");
    if(!current.isAdmin&&!current.employeeId)return Response.json({error:"Your login is not connected to an employee record."},{status:403});
    if(action==="createRotation"){
      if(!current.isAdmin)return Response.json({error:"Administrator access is required."},{status:403});
      const name=String(p.name??"").trim(),startDate=String(p.startDate??""),endDate=String(p.endDate??""),startTime=String(p.startTime??""),endTime=String(p.endTime??""),role=String(p.role??"").trim(),cycleDays=Number(p.cycleDays);
      const dutyDays=[...new Set(String(p.dutyDays??"").split(",").map(v=>Number(v.trim())).filter(Number.isInteger))],employeeIds=[...new Set(Array.isArray(p.employeeIds)?p.employeeIds.map(String).filter(Boolean):[])],span=spanDays(startDate,endDate);
      if(!name||!iso.test(startDate)||!iso.test(endDate)||span<0||span>730||!clock.test(startTime)||!clock.test(endTime)||!role||!Number.isInteger(cycleDays)||cycleDays<1||cycleDays>60||!dutyDays.length||dutyDays.some(d=>d<0||d>=cycleDays)||!employeeIds.length)return Response.json({error:"Complete the rotation, duty pattern, and employee selection."},{status:400});
      const rotationId=crypto.randomUUID(); await db.prepare("INSERT INTO schedule_rotations(id,name,start_date,end_date,start_time,end_time,cycle_days,duty_days,role,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(rotationId,name,startDate,endDate,startTime,endTime,cycleDays,dutyDays.join(","),role,current.name).run();
      await db.batch(employeeIds.map(e=>db.prepare("INSERT INTO schedule_rotation_members(rotation_id,employee_id) VALUES(?,?)").bind(rotationId,e)));
      const writes=[]; for(let n=0;n<=span;n++){if(!dutyDays.includes(n%cycleDays))continue;for(const e of employeeIds)writes.push(db.prepare("INSERT OR IGNORE INTO schedule_assignments(id,employee_id,work_date,start_time,end_time,role,source,rotation_id,status,created_by) VALUES(?,?,?,?,?,?,'rotation',?,'assigned',?)").bind(crypto.randomUUID(),e,addDays(startDate,n),startTime,endTime,role,rotationId,current.name));}
      for(let n=0;n<writes.length;n+=75)await db.batch(writes.slice(n,n+75)); await notify(db,employeeIds,"New rotating schedule",`${name} was assigned from ${startDate} through ${endDate}.`); return Response.json({ok:true,assignmentsCreated:writes.length});
    }
    if(action==="createShift"){
      if(!current.isAdmin)return Response.json({error:"Administrator access is required."},{status:403});
      const employeeId=String(p.employeeId??""),workDate=String(p.workDate??""),startTime=String(p.startTime??""),endTime=String(p.endTime??""),role=String(p.role??"").trim(),notes=String(p.notes??"").trim(),emergency=Boolean(p.emergency);
      if(!iso.test(workDate)||!clock.test(startTime)||!clock.test(endTime)||!role)return Response.json({error:"Enter a date, times, and position."},{status:400});
      await db.prepare("INSERT INTO schedule_assignments(id,employee_id,work_date,start_time,end_time,role,source,status,emergency,notes,created_by) VALUES(?,NULLIF(?,''),?,?,?,?,'manual',?,?,?,?)").bind(crypto.randomUUID(),employeeId,workDate,startTime,endTime,role,employeeId?"assigned":"open",emergency?1:0,notes,current.name).run();
      const recipients=employeeId?[employeeId]:(await db.prepare("SELECT id FROM employees WHERE active=1").all<{id:string}>()).results.map(r=>r.id); await notify(db,recipients,emergency?"Emergency coverage needed":employeeId?"Schedule assignment":"Open shift available",`${workDate} ${startTime}-${endTime} · ${role}${notes?` · ${notes}`:""}`); return Response.json({ok:true});
    }
    if(action==="submitRequest"){
      const employeeId=current.isAdmin&&p.employeeId?String(p.employeeId):current.employeeId??"",requestType=String(p.requestType??""),assignmentId=String(p.assignmentId??""),targetEmployeeId=String(p.targetEmployeeId??""),startDate=String(p.startDate??""),endDate=String(p.endDate??startDate);
      if(!employeeId||!["availability","time_off","shift_claim","trade"].includes(requestType)||!iso.test(startDate)||!iso.test(endDate))return Response.json({error:"Complete the schedule request."},{status:400});
      await db.prepare("INSERT INTO schedule_requests(id,request_type,employee_id,assignment_id,target_employee_id,start_date,end_date,start_time,end_time,role,repeat_mode,notes) VALUES(?,?,?,NULLIF(?,''),NULLIF(?,''),?,?,?,?,?,?,?)").bind(crypto.randomUUID(),requestType,employeeId,assignmentId,targetEmployeeId,startDate,endDate,String(p.startTime??""),String(p.endTime??""),String(p.role??""),String(p.repeatMode??"none"),String(p.notes??"")).run();
      await notify(db,await admins(db),"New schedule request",`${current.name} submitted a ${requestType.replace("_"," ")} request for ${startDate}.`); return Response.json({ok:true});
    }
    if(action==="reviewRequest"){
      if(!current.isAdmin)return Response.json({error:"Administrator access is required."},{status:403});
      const id=String(p.id??""),decision=String(p.decision??""); if(!["approved","denied"].includes(decision))return Response.json({error:"Choose approve or deny."},{status:400});
      const item=await db.prepare("SELECT request_type requestType,employee_id employeeId,assignment_id assignmentId,target_employee_id targetEmployeeId FROM schedule_requests WHERE id=? AND status='pending'").bind(id).first<{requestType:string;employeeId:string;assignmentId:string|null;targetEmployeeId:string|null}>(); if(!item)return Response.json({error:"Request is no longer pending."},{status:409});
      if(decision==="approved"&&item.assignmentId&&item.requestType==="shift_claim")await db.prepare("UPDATE schedule_assignments SET employee_id=?,status='assigned' WHERE id=? AND status='open'").bind(item.employeeId,item.assignmentId).run();
      if(decision==="approved"&&item.assignmentId&&item.requestType==="trade"&&item.targetEmployeeId)await db.prepare("UPDATE schedule_assignments SET employee_id=? WHERE id=? AND employee_id=?").bind(item.targetEmployeeId,item.assignmentId,item.employeeId).run();
      await db.prepare("UPDATE schedule_requests SET status=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?").bind(decision,current.name,id).run(); await notify(db,[item.employeeId,...(item.targetEmployeeId?[item.targetEmployeeId]:[])],`Schedule request ${decision}`,`Your request was ${decision} by ${current.name}.`); return Response.json({ok:true});
    }
    if(action==="markRead"&&current.employeeId){await db.prepare("UPDATE schedule_notifications SET read_at=CURRENT_TIMESTAMP WHERE id=? AND employee_id=?").bind(String(p.id??""),current.employeeId).run();return Response.json({ok:true});}
    return Response.json({error:"Unsupported scheduling action."},{status:400});
  } catch(error){return Response.json({error:error instanceof Error?error.message:"Unable to save scheduling"},{status:500});}
}
