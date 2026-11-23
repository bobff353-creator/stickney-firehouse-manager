import { z } from 'zod';
import { planSchema } from './preplan.ts';
import {distanceMeters,type Coordinate} from './footprint.ts';
const id = z.string().regex(/^[a-zA-Z0-9-]{1,100}$/);
export const sourceFileSchema = z.object({
  key: id, name: z.string().max(250), type: z.enum(['image/png','image/jpeg','image/webp','application/pdf']),
  size: z.number().int().positive().max(8*1024*1024), sha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  caption: z.string().max(1000), originalUrl: z.string().url().max(1000),
  side: z.enum(['Overview','Plan']),
});
export const hydrantSchema = z.object({
  id, number: z.string().max(100), address:z.string().max(500),
  latitude:z.number().finite().min(-85).max(85).nullable(), longitude:z.number().finite().min(-180).max(180).nullable(),
  status:z.enum(['In service','Out of service','Unknown','Conflicting reports']),
  reportedFlow:z.number().finite().nonnegative().max(100000).nullable(),
  flowSourceDate:z.string().max(50).nullable(), statusSourceDate:z.string().max(50).nullable(),
  notes:z.string().max(12000), sources:z.array(z.string().max(100)).max(10),
});
export type Hydrant = z.infer<typeof hydrantSchema>;
export const importEntitySchema = z.object({
  id, kind:z.enum(['plan','hydrant','queue','held']), name:z.string().max(200),address:z.string().max(500),
  keys:z.array(z.string().regex(/^(stickney|flowmsp|queue):[a-zA-Z0-9-]{1,100}$/)).min(1).max(30),
  plan:planSchema.optional(), hydrant:hydrantSchema.optional(),
  sourcePublished:z.boolean(), sourcePublishedAt:z.string().max(50).nullable(),
  sourceStatus:z.string().max(200), warnings:z.array(z.string().max(1000)).max(50),
  files:z.array(sourceFileSchema).max(200),
  raw:z.record(z.unknown()),
});
export type ImportEntity=z.infer<typeof importEntitySchema>;
export type ImportPackage={format:'arrival-source-import-v1'; createdAt:string; summary:Record<string,unknown>; records:ImportEntity[]};
export type ImportSummary={id:string;kind:string;name:string;address:string;sourceStatus:string;warnings:string[];fileCount:number;copiedFiles:number;linkedFiles:number;complete:boolean;entityId:string};
export function normalizeStreet(address:string) {
  return address.toLowerCase().replace(/\b(illinois)\b/g,'il').replace(/[.,]/g,' ').replace(/\b(street|road|avenue|boulevard|drive|court|place|lane)\b/g,m=>({street:'st',road:'rd',avenue:'ave',boulevard:'blvd',drive:'dr',court:'ct',place:'pl',lane:'ln'}[m]!)).replace(/\s+/g,' ').trim();
}
export function sourceFileUrlAllowed(url:string) {
  const u=new URL(url);
  return u.protocol==='https:' && (['stickney-firehouse-manager-fire-pre-plan-pro.vercel.app','stickney-firehouse-manager.vercel.app','app.flowmsp.com'].includes(u.hostname) || (u.hostname==='s3.amazonaws.com' && u.pathname.startsWith('/flowmsp-images/') && u.pathname.includes('/stickneyfire/')));
}

export function canonicalJson(value:unknown):string { if(value===null||typeof value!=="object")return JSON.stringify(value);if(Array.isArray(value))return "["+value.map(canonicalJson).join(",")+"]";return "{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+canonicalJson((value as Record<string,unknown>)[k])).join(",")+"}";}
export function separateMappedStructures(a:Coordinate[][]|undefined,b:Coordinate[][]|undefined){
 if(!a?.[0]?.length||!b?.[0]?.length)return false;
 const bounds=(ring:Coordinate[])=>({x0:Math.min(...ring.map(p=>p[0])),x1:Math.max(...ring.map(p=>p[0])),y0:Math.min(...ring.map(p=>p[1])),y1:Math.max(...ring.map(p=>p[1]))});
 const x=bounds(a[0]),y=bounds(b[0]);
 if(!(x.x1<y.x0||y.x1<x.x0||x.y1<y.y0||y.y1<x.y0))return false;
 const ax=(x.x0+x.x1)/2,ay=(x.y0+x.y1)/2,bx=(y.x0+y.x1)/2,by=(y.y0+y.y1)/2;
 const nearA:Coordinate=[Math.max(x.x0,Math.min(x.x1,bx)),Math.max(x.y0,Math.min(x.y1,by))];
 const nearB:Coordinate=[Math.max(y.x0,Math.min(y.x1,ax)),Math.max(y.y0,Math.min(y.y1,ay))];
 return distanceMeters(nearA,nearB)>=5;
}
