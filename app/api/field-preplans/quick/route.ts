import {ensureDatabase} from '../../../../db/bootstrap';
import {hasPermission} from '../../../server-permissions';

const txt=(v:unknown,n=2000)=>String(v??'').trim().slice(0,n);
const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
export async function POST(request:Request){
 try{
  const db=await ensureDatabase();
  if(!await hasPermission(request,db,'field_preplans.edit')||request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Preplan edit permission is required.'},{status:403});
  const body=await request.json() as Record<string,unknown>;
  if(body.action==='locate'){
   const address=txt(body.address,240),key=process.env.GOOGLE_MAPS_GEOCODING_KEY?.trim();
   if(!address)return Response.json({error:'Enter the street address.'},{status:400});
   const addressKey=(value:string)=>norm(value.split(',')[0].replace(/\bstreet\b/gi,'st').replace(/\broad\b/gi,'rd').replace(/\bavenue\b/gi,'ave').replace(/\bsouth\b/gi,'s').replace(/\bnorth\b/gi,'n').replace(/\beast\b/gi,'e').replace(/\bwest\b/gi,'w'));
   const known=await db.prepare('SELECT id,address,latitude,longitude FROM field_preplans').all<{id:string;address:string;latitude:number;longitude:number}>();
   const matches=known.results.filter(p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&addressKey(p.address)===addressKey(address));
   if(matches.length===1)return Response.json({location:{lat:matches[0].latitude,lng:matches[0].longitude},existingId:matches[0].id,address:matches[0].address});
   if(matches.length>1)return Response.json({error:'Several saved buildings use this address. Select the correct building on the map.'},{status:409});
   if(!key)return Response.json({error:'Address lookup is unavailable. Tap the building on the map.'},{status:503});
   const url=new URL('https://maps.googleapis.com/maps/api/geocode/json');url.searchParams.set('address',address);url.searchParams.set('key',key);url.searchParams.set('region','us');
   const response=await fetch(url,{signal:AbortSignal.timeout(10000)}),result=await response.json();
   if(!response.ok||result.status!=='OK'||!result.results?.[0])return Response.json({error:result.status==='ZERO_RESULTS'?'Address not found. Check the address or tap the building on the map.':'Address lookup is unavailable. Tap the building on the map.'},{status:400});
   const match=result.results[0];return Response.json({location:match.geometry.location,address:match.formatted_address});
  }
  const id=txt(body.id,80),businessName=txt(body.businessName,180),address=txt(body.address,240),lat=Number(body.latitude),lng=Number(body.longitude),floors=Number(body.floorCount);
  if(!/^[\w-]{8,80}$/.test(id)||!businessName||!address||body.locationConfirmed!==true||!Number.isFinite(lat)||!Number.isFinite(lng)||lat< -90||lat>90||lng< -180||lng>180||!Number.isInteger(floors)||floors<0||floors>99)return Response.json({error:'Enter a building name and address, confirm its map location and check the floor count.'},{status:400});
  const actor=request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase()??'';
  const answer=(v:unknown)=>['Yes','No','Unknown'].includes(String(v))?String(v):'Unknown';
  const expected={businessName,address,latitude:lat,longitude:lng,floorCount:floors,accessInfo:txt(body.accessInfo),alarmSystem:answer(body.alarmSystem),knoxBox:answer(body.knoxBox),fdc:answer(body.fdc),sprinklerSystem:answer(body.sprinklerSystem),createdBy:actor};
  const read=()=>db.prepare('SELECT id,business_name businessName,address,latitude,longitude,floor_count floorCount,access_info accessInfo,alarm_system alarmSystem,knox_box knoxBox,fdc,sprinkler_system sprinklerSystem,created_by createdBy FROM field_preplans WHERE id=?').bind(id).first();
  const same=(row:Record<string,unknown>)=>Object.entries(expected).every(([key,value])=>row[key]===value);
  const prior=await read();
  if(prior){if(same(prior))return Response.json({ok:true,id});return Response.json({error:'This save ID already has different information. Open the saved record to update it.',existingId:id},{status:409});}
  const records=await db.prepare('SELECT id,business_name businessName,address,latitude,longitude FROM field_preplans').all<{id:string;businessName:string;address:string;latitude:number;longitude:number}>();
  const duplicate=records.results.find(p=>norm(p.businessName)===norm(businessName)&&(norm(p.address)===norm(address)||norm(p.address.split(',')[0])===norm(address.split(',')[0])&&Math.abs(p.latitude-lat)<.0002&&Math.abs(p.longitude-lng)<.0002));
  if(duplicate)return Response.json({error:'This building already has a preplan. Open it to add details.',existingId:duplicate.id},{status:409});
  await db.prepare("INSERT INTO field_preplans(id,business_name,address,latitude,longitude,footprint,footprint_square_feet,floor_count,construction_type,occupancy_flow_category,sprinkler_standard,access_info,alarm_system,knox_box,fdc,sprinkler_system,status,publication_status,completeness_status,created_by,updated_by) VALUES(?,?,?,?,?,'[]',0,?,'unknown','other','unknown',?,?,?,?,?,'Quick Preplan','draft','incomplete',?,?) ON CONFLICT(id) DO NOTHING")
   .bind(id,businessName,address,lat,lng,floors,txt(body.accessInfo),answer(body.alarmSystem),answer(body.knoxBox),answer(body.fdc),answer(body.sprinklerSystem),actor,actor).run();
  const saved=await read();
  if(!saved||!same(saved))return Response.json({error:'This save ID already has different information. Open the saved record.',existingId:id},{status:409});
  return Response.json({ok:true,id});
 }catch{return Response.json({error:'The preplan save was not confirmed. Keep this screen open and retry.'},{status:503});}
}
