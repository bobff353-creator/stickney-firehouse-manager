import type { PlanData, PlanRecord } from './preplan';
import type { HydrantRecord } from './hydrant-activity';
export type MapView = { lat: number; lng: number; zoom: number };
export type Basemap = 'street'|'satellite';
export type OverviewState = { mode: 'map'|'list'; basemap:Basemap; query: string; filter: 'all'|'published'|'draft'|'review'|'out'; buildings: boolean; hydrants: boolean; selected: string|null; view?: MapView };
export const initialOverview: OverviewState = {mode:'map',basemap:'street',query:'',filter:'all',buildings:true,hydrants:true,selected:null};
export type MapItem = {id:string;kind:'building'|'hydrant';name:string;address:string;position:[number,number]|null;status:string;plan?:PlanRecord;hydrant?:HydrantRecord};
export function planPosition(p:PlanData):[number,number]|null {
  const ring=p.footprint?.rings[0];
  if(ring?.length){const xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]);return [(Math.min(...ys)+Math.max(...ys))/2,(Math.min(...xs)+Math.max(...xs))/2];}
  if(!p.latitude.trim()||!p.longitude.trim())return null;
  const lat=Number(p.latitude),lng=Number(p.longitude);
  return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=85&&Math.abs(lng)<=180?[lat,lng]:null;
}
export function overviewItems(plans:PlanRecord[],hydrants:HydrantRecord[]):MapItem[]{
 return [...plans.map(r=>{const p=r.published||r.working;return {id:'plan:'+r.id,kind:'building' as const,name:p.name||r.name,address:p.city&&p.address.toLowerCase().includes(p.city.toLowerCase())?p.address:[p.address,p.city].filter(Boolean).join(', '),position:planPosition(p),status:r.published?'Published':r.status==='review'?'For review':'Draft',plan:r};}),...hydrants.map(h=>({id:'hydrant:'+h.id,kind:'hydrant' as const,name:'Hydrant '+(h.number||'· unnumbered'),address:h.address,position:h.latitude!==null&&h.longitude!==null?[h.latitude,h.longitude] as [number,number]:null,status:h.status,hydrant:h}))];
}
export function filterOverview(items:MapItem[],s:OverviewState){
 const q=s.query.trim().toLowerCase();
 return items.filter(i=>(i.kind==='building'?s.buildings:s.hydrants)&&(!q||(i.name+' '+i.address+' '+i.status).toLowerCase().includes(q))&&(s.filter==='all'||s.filter==='out'&&i.kind==='hydrant'&&i.status==='Out of service'||s.filter==='published'&&i.kind==='building'&&!!i.plan?.published||s.filter==='draft'&&i.kind==='building'&&!i.plan?.published&&i.plan?.status==='draft'||s.filter==='review'&&i.kind==='building'&&i.plan?.status==='review'));
}
export function mapGroups(items:MapItem[],pixel:(p:[number,number])=>{x:number;y:number},zoom:number,selected:string|null):MapItem[][]{
 const groups=new Map<string,MapItem[]>();
 for(const item of items){if(!item.position)continue;const p=pixel(item.position);const key=zoom>=18||item.id===selected||item.status==='Out of service'?item.id:Math.floor(p.x/48)+','+Math.floor(p.y/48);const group=groups.get(key)||[];group.push(item);groups.set(key,group);}
 return [...groups.values()];
}
