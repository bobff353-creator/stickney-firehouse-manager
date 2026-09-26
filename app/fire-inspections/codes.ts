export const codeTypes = ['Local ordinance','IBC','IFC','IEBC','NFPA 101','NFPA','State rule','Other'];
export type CodeEntry = { id:string; version:number; archived:boolean; updatedAt:string; updatedBy:string; data:CodeData };
export type CodeData = { type:string; edition:string; jurisdiction:string; section:string; title:string; text:string; sourceUrl:string; applicability:string; effectiveDate:string; category:string; frequent:string };
export type CodeSelection = CodeData & { id:string; version:number };
export const emptyCode = ():CodeData=>({type:'Local ordinance',edition:'',jurisdiction:'',section:'',title:'',text:'',sourceUrl:'',applicability:'',effectiveDate:'',category:'',frequent:''});
export function normalizeCode(value:unknown):CodeData {
 if(!value||typeof value!=='object')throw Error('Code details are missing.');
 const d=emptyCode(),v=value as Record<string,unknown>;
 for(const k of Object.keys(d) as (keyof CodeData)[])d[k]=String(v[k]??'').trim().slice(0,k==='text'?40000:k==='applicability'?4000:1000);
 d.frequent=d.frequent==='yes'?'yes':'';
 if(!codeTypes.includes(d.type)||!d.title||!d.edition)throw Error('Choose a code type and enter its title and edition or ordinance version.');
 if(d.sourceUrl){let u:URL;try{u=new URL(d.sourceUrl);}catch{throw Error('Use a complete source link beginning with https://.');}if(u.protocol!=='https:'&&u.protocol!=='http:')throw Error('Use an http or https source link.');}
 if(d.effectiveDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(d.effectiveDate)||Number.isNaN(Date.parse(d.effectiveDate))||new Date(d.effectiveDate).toISOString().slice(0,10)!==d.effectiveDate))throw Error('Use a valid effective date.');
 return d;
}
export const codeLabel=(d:CodeData)=>`${d.type} ${d.edition}${d.section?` § ${d.section}`:''} · ${d.title}${d.jurisdiction?` · ${d.jurisdiction}`:''}`;
export const selectCode=(c:CodeEntry):CodeSelection=>({...c.data,id:c.id,version:c.version});
export const needsAdoptionReview=(d:CodeData)=>d.applicability.startsWith('ADOPTION NOT VERIFIED:');
export function localAmendmentQuery(entries:CodeEntry[],data:CodeData) {
 const ancestors=entries.filter(c=>!c.archived&&c.data.type==='Local ordinance'&&c.data.edition===data.edition)
  .map(c=>c.data.section.split(' / IBC ')[1]).filter((s):s is string=>!!s&&(s===data.section||data.section.startsWith(s+'.')));
 return ancestors.sort((a,b)=>a.length-b.length)[0]||data.section;
}
export function searchCodes(entries:CodeEntry[],query='',type='',edition='',jurisdiction='',category='',frequentOnly=false) {
 const words=query.toLowerCase().split(/\s+/).filter(Boolean);
 return entries.filter(c=>!c.archived&&(!type||c.data.type===type)&&(!edition||c.data.edition===edition)&&(!jurisdiction||c.data.jurisdiction===jurisdiction)&&(!category||c.data.category===category)&&(!frequentOnly||c.data.frequent==='yes')&&words.every(w=>Object.values(c.data).join(' ').toLowerCase().includes(w)))
  .sort((a,b)=>(b.data.frequent==='yes'?1:0)-(a.data.frequent==='yes'?1:0)||a.data.type.localeCompare(b.data.type)||a.data.section.localeCompare(b.data.section,undefined,{numeric:true})||a.data.title.localeCompare(b.data.title));
}
