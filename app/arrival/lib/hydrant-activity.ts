import {z} from 'zod';
import {chicagoDate} from './preplan.ts';
import type {Hydrant} from './imports';
export type HydrantRecord=Hydrant&{recordId:string;revision:number;lastMaintenance?:string;lastFlushed?:string;flowTestDate?:string;statusUpdatedOn?:string};
export const activityKinds=['maintenance','flushing','flow'] as const;
export const activityLabels={maintenance:'Maintenance',flushing:'Flushing',flow:'Flow update'};
export const hydrantActivitySchema=z.object({
 id:z.string().uuid(),revision:z.number().int().positive(),kind:z.enum(activityKinds),
 performedOn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),notes:z.string().trim().max(3000),
 status:z.enum(['','In service','Out of service','Unknown']),flowGpm:z.number().finite().positive().max(100000).nullable(),
}).superRefine((v,ctx)=>{
 const time=Date.parse(v.performedOn+'T12:00:00Z');
 if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==v.performedOn||v.performedOn>chicagoDate())ctx.addIssue({code:'custom',path:['performedOn'],message:'Choose a valid work date that is not in the future.'});
 if(v.kind==='maintenance'&&!v.notes)ctx.addIssue({code:'custom',path:['notes'],message:'Add a short description of the maintenance.'});
 if(v.kind==='flow'&&v.flowGpm===null)ctx.addIssue({code:'custom',path:['flowGpm'],message:'Enter the recorded flow in GPM.'});
 if(v.kind!=='flow'&&v.flowGpm!==null)ctx.addIssue({code:'custom',path:['flowGpm'],message:'Use Flow update to record a flow reading.'});
});
export type HydrantActivityInput=z.infer<typeof hydrantActivitySchema>;
export type HydrantActivity={id:string;kind:typeof activityKinds[number];performedOn:string;notes:string;status:string|null;flowGpm:number|null;at:string};
export function applyHydrantActivity(h:HydrantRecord,p:HydrantActivityInput):HydrantRecord{
 const next={...h};
 if(p.kind==='flushing'&&p.performedOn>=(h.lastFlushed||''))next.lastFlushed=p.performedOn;
 if(p.kind==='maintenance'&&p.performedOn>=(h.lastMaintenance||''))next.lastMaintenance=p.performedOn;
 if(p.kind==='flow'&&p.performedOn>=(h.flowTestDate||'')){next.reportedFlow=p.flowGpm;next.flowTestDate=p.performedOn;}
 if(p.status&&p.performedOn>=(h.statusUpdatedOn||h.statusSourceDate?.slice(0,10)||'')){next.status=p.status;next.statusUpdatedOn=p.performedOn;}
 return next;
}
