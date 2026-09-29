import {ensureDatabase} from '../../db/bootstrap';
import {nerisPilotAccess} from './access';
import type {NerisRecord} from './model';
export const nerisJson=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store, max-age=0',Vary:'Cookie'}});
export function nerisBoundary(request:Request,write=false){if(!nerisPilotAccess(request.headers.get('oai-authenticated-user-email'))||!request.headers.get('x-department-id'))return nerisJson({error:'NERIS Reporting is private to the designated pilot owner.'},403);if(write&&request.headers.get('origin')!==new URL(request.url).origin)return nerisJson({error:'Open NERIS Reporting in this portal before saving.'},403);return null;}
export type Db=Awaited<ReturnType<typeof ensureDatabase>>;
export type Stored={id:string;kind:NerisRecord['kind'];payload:string;version:number;archived:number;createdAt:string;updatedAt:string;updatedBy:string};
export const columns='id,kind,payload,version,archived,created_at createdAt,updated_at updatedAt,updated_by updatedBy';
export function decode(row:Stored):NerisRecord{return{id:row.id,kind:row.kind,data:JSON.parse(row.payload),version:row.version,archived:Boolean(row.archived),createdAt:row.createdAt,updatedAt:row.updatedAt,updatedBy:row.updatedBy};}
