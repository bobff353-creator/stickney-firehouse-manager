import { createHash } from 'node:crypto';
import { locationDatabase } from '../../../lib/apparatus-location-store';
import { validLocationFix } from '../../../apparatus-location-domain';
const headers={'Cache-Control':'private, no-store'};
export async function POST(request: Request) {
 try {
  const authorization=request.headers.get('authorization');
  const native=authorization?.startsWith('Bearer ');
  if(!native && request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Device authorization required.'},{status:401,headers});
  const token=native?authorization!.slice(7):request.headers.get('cookie')?.match(/(?:^|;\s*)__Secure-firehouse-tracker=([A-Za-z0-9_-]+)/)?.[1];
  if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token))return Response.json({error:'Device authorization required.'},{status:401,headers});
  const raw=await request.text();if(raw.length>2048)return Response.json({error:'Location message too large.'},{status:413,headers});
  let fix:unknown;try{fix=JSON.parse(raw);}catch{return Response.json({error:'Invalid location message.'},{status:400,headers});}
  if(!validLocationFix(fix))return Response.json({accepted:false,reason:'invalid_fix'},{status:422,headers});
  const hash=createHash('sha256').update(token).digest('hex');
  const row=await locationDatabase().prepare('SELECT ingest_apparatus_location(?,?) result').bind(hash,Buffer.from(JSON.stringify(fix)).toString('base64')).first<{result:{accepted:boolean;reason?:string;retryAfterMs?:number}}>();
  if(!row)throw Error('Unavailable');
  return Response.json(row.result,{status:row.result.reason==='device_revoked'?401:row.result.reason==='rate_limited'?429:row.result.reason==='invalid_fix'?422:200,headers});
 }catch{return Response.json({accepted:false,reason:'storage_unavailable'},{status:503,headers});}
}
