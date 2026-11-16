import {backgroundDatabase} from '../../../background-database';
import {getPortalDepartment} from '../../../department-portal';
import {runReminderDraftPage,type ReminderEngineContext} from '../../../fire-inspections/reminder-draft-service';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return new Response('Unauthorized',{status:401,headers:{'Cache-Control':'no-store'}});
 try{const department=await getPortalDepartment();if(department.isolated)return Response.json({error:'This department reminder integration is not configured.'},{status:503,headers:{'Cache-Control':'no-store'}});
  const context:ReminderEngineContext={db:backgroundDatabase(),departmentId:department.id,actor:'scheduled-inspection-reminder-worker',background:true},started=Date.now(),clock=new Date();let result:Awaited<ReturnType<typeof runReminderDraftPage>>,pages=0;
  do{result=await runReminderDraftPage(context,{mode:'cron',now:clock});pages++;}while(result.hasMore&&result.state!=='busy'&&Date.now()-started<45000&&pages<12);
  return Response.json({...result,pages,draftOnly:true,sent:0},{headers:{'Cache-Control':'no-store'}});
 }catch{console.error('Scheduled inspection reminder draft scan paused; no email was sent.');return Response.json({error:'The scheduled reminder scan paused. Checkpoints remain saved for the next authenticated tick.',draftOnly:true,sent:0},{status:503,headers:{'Cache-Control':'no-store'}});}
}
