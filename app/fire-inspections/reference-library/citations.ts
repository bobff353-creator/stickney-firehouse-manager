import {getOccupancyGroup,getGroupFamilies} from './classification';

/** Original citation index and inspection prompts; no publisher code text. */
export type Citation={
 id:string;title:string;code:string;edition:string;section:string;summary:string;correction:string;
 category:string;occupancies:string[];occupancyGroups?:string[];keywords:string[];sourceUrl:string;sourceVerified:boolean;
 verificationNote?:string;approval:'pending'|'approved';favorite?:boolean;approvedBy?:string;
 approvedAt?:string;approvalProfile?:string;updatedAt?:string;archived?:boolean;
};
export type CitationAttachment=Pick<Citation,'id'|'title'|'code'|'edition'|'section'|'summary'|'correction'|'sourceUrl'|'sourceVerified'|'approvedBy'|'approvedAt'|'approvalProfile'|'occupancyGroups'> & {approval:'pending'|'approved';attachedAt:string};
export type CitationSettings={jurisdiction?:string;code?:string;ordinance?:string;effectiveDate?:string;codeNote?:string;adoptionVerified?:boolean};
export type CitationFilters={occupancy?:string;occupancyGroups?:string[];category?:string;code?:string;edition?:string;favoritesOnly?:boolean;approval?:'all'|'approved'|'pending';settings?:CitationSettings};
const text=(value:unknown)=>typeof value==='string'?value.trim():'';
export function approvalProfileKey(settings?:CitationSettings):string{return 'citation-profile-v1:'+JSON.stringify([settings?.jurisdiction,settings?.code,settings?.ordinance,settings?.effectiveDate,settings?.codeNote].map(value=>text(value).replace(/\s+/g,' ')));}
export function adoptionReady(settings?:CitationSettings):boolean{const value=text(settings?.effectiveDate);if(settings?.adoptionVerified!==true||!text(settings.code)||!text(settings.ordinance)||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+'T12:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;}
export function isCitationApproved(citation:Citation,settings?:CitationSettings):boolean{return citation.approval==='approved'&&adoptionReady(settings)&&citation.sourceVerified===true&&!!text(citation.approvedBy)&&Number.isFinite(Date.parse(citation.approvedAt??''))&&citation.approvalProfile===approvalProfileKey(settings);}
export function formatCitation(citation:Pick<Citation,'code'|'edition'|'section'>):string{return `${citation.code} (${citation.edition}) § ${citation.section}`;}
export function validateCitation(value:unknown):string[]{
 const errors:string[]=[];if(!value||typeof value!=='object'||Array.isArray(value))return ['A citation record is required.'];const c=value as Record<string,unknown>;
 for(const [field,max,label] of [['id',128,'Reference ID'],['title',200,'Reference title'],['code',60,'Code family'],['edition',60,'Edition'],['section',120,'Section'],['category',100,'Category']] as const){if(!text(c[field])||typeof c[field]!=='string'||(c[field] as string).length>max)errors.push(`${label} is required and must be ${max} characters or fewer.`);}
 for(const [field,max,label] of [['summary',1600,'Inspection prompt'],['correction',1600,'Correction wording'],['verificationNote',1200,'Verification notes']] as const){if((field!=='verificationNote'||c[field]!==undefined)&&(typeof c[field]!=='string'||(c[field] as string).length>max))errors.push(`${label} must be ${max} characters or fewer.`);}
 for(const [field,max,length] of [['keywords',80,100],['occupancies',30,100]] as const){if(!Array.isArray(c[field])||(c[field] as unknown[]).length>max||(c[field] as unknown[]).some(v=>typeof v!=='string'||!v.trim()||v.length>length))errors.push(`${field==='keywords'?'Search keywords':'Occupancies'} must be a list of short text values.`);}
 if(c.occupancyGroups!==undefined&&(!Array.isArray(c.occupancyGroups)||c.occupancyGroups.length>26||new Set(c.occupancyGroups).size!==c.occupancyGroups.length||c.occupancyGroups.some(v=>typeof v!=='string'||getOccupancyGroup(v)?.code!==v)))errors.push('Occupancy groups must be a list of unique ICC group codes.');
 try{const url=new URL(String(c.sourceUrl));if(!['http:','https:'].includes(url.protocol)||url.username||url.password||String(c.sourceUrl).length>2000)throw Error();}catch{errors.push('Enter a valid HTTP or HTTPS official source URL without embedded credentials.');}
 if(c.approval!=='pending'&&c.approval!=='approved')errors.push('Choose a valid approval state.');
 if(typeof c.sourceVerified!=='boolean')errors.push('Record whether the source reference was checked.');
 for(const field of ['favorite','archived'])if(c[field]!==undefined&&typeof c[field]!=='boolean')errors.push(`${field} must be true or false.`);
 for(const [field,max] of [['approvedBy',160],['approvedAt',60],['approvalProfile',12000]] as const)if(c[field]!==undefined&&(typeof c[field]!=='string'||(c[field] as string).length>max))errors.push('Approval metadata is invalid.');
 return errors;
}
export function mergeCitationLibrary(seeds:Citation[],saved:Citation[]):Citation[]{const merged=new Map(seeds.map(c=>[c.id,c]));for(const citation of saved){if(citation?.id&&validateCitation(citation).length===0)merged.set(citation.id,citation);}return [...merged.values()].filter(c=>!c.archived);}

const replacements:Record<string,string>={
 extiguisher:'extinguisher',extiguisers:'extinguisher',extiguisherlocation:'extinguisher location',extinguishers:'extinguisher',extingushers:'extinguisher',extingusher:'extinguisher',extinquishers:'extinguisher',extinquisher:'extinguisher',extinguiser:'extinguisher',fireextinguisher:'extinguisher',
 doors:'door',doorways:'door',doorway:'door',exits:'exit',egress:'exit',openings:'opening',opens:'opening',open:'opening',locations:'location',located:'location',locate:'location',placement:'location',position:'location',positions:'location',where:'location',
 swings:'swing',swinging:'swing',forces:'force',pressure:'force',pounds:'force',widths:'width',clearances:'clearance',locks:'lock',locked:'lock',locking:'lock',latches:'latch',unlatching:'latch',obstructed:'blocked',obstructions:'blocked',obstruction:'blocked',blocked:'blocked',
 warehouses:'warehouse',wearhouse:'warehouse',wearhouses:'warehouse',sprinklers:'sprinkler',alarms:'alarm',batteries:'battery',cords:'cord',extensions:'extension',inspections:'inspection',receptacles:'outlet'
};
const stop=new Set(['a','an','the','and','or','of','for','to','in','on','with','is','are','what','how','do','does','need','required','requirement','requirements','code','codes','rule','rules','about','it','i','my','can']);
function words(value:string):string[]{const normalized=value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9.]+/g,' ').trim();return normalized.split(/\s+/).filter(Boolean).flatMap(token=>(replacements[token]??token).split(' '));}
const groups:Record<string,string[]>={
 exit:['exit','escape','evacuation','corridor','aisle'],door:['door','hardware','latch','panic','lock'],opening:['opening','width','height','swing','force','operation','hardware','clearance','threshold'],
 location:['location','mounting','placement','access','visible','conspicuous','distribution','travel','distance','height','obscured'],
 blocked:['blocked','obstructed','obscured','accessible','access','storage'],force:['force','push','pull','pressure','operation'],
 extinguisher:['extinguisher'],sprinkler:['sprinkler','riser','water-based','standpipe'],alarm:['alarm','detection','detector','signaling'],
 lock:['lock','latch','hardware','panic'],latch:['latch','lock','hardware'],sign:['sign','signage','identification'],light:['light','lighting','illumination','emergency'],
 storage:['storage','stored','rack','commodity','aisle','high-piled'],cord:['cord','extension','wiring','outlet','electrical'],battery:['battery','charging','lithium','energy'],
};
function distance(a:string,b:string,limit=2):number{if(Math.abs(a.length-b.length)>limit)return limit+1;let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));if(Math.min(...next)>limit)return limit+1;row=next;}return row[b.length];}
function exactOrTypo(token:string,terms:Set<string>):boolean{if(terms.has(token))return true;if(token.length<5)return false;for(const term of terms){if(term.length>=5&&term[0]===token[0]&&distance(token,term,token.length>=8?2:1)<=(token.length>=8?2:1))return true;}return false;}

/** Ranked, local-only matching; never sends inspection search terms to a service. */
export function searchCitations(citations:Citation[],query:string,filters:CitationFilters={}):Citation[]{
 const tokens=[...new Set(words(query).filter(token=>!stop.has(token)))];const compact=query.toLowerCase().replace(/[^a-z0-9.]/g,'');
 const contextGroups=[...new Set((filters.occupancyGroups??[]).filter(group=>!!getOccupancyGroup(group)))];
 const ranked=citations.filter(c=>!c.archived).filter(c=>!filters.occupancy||filters.occupancy==='All'||filters.occupancy==='All occupancies'||!c.occupancies.length||c.occupancies.includes(filters.occupancy)).filter(c=>!filters.category||filters.category==='All'||filters.category==='All categories'||c.category===filters.category).filter(c=>!filters.code||filters.code==='All'||filters.code==='All codes'||c.code===filters.code).filter(c=>!filters.edition||filters.edition==='All'||filters.edition==='All editions'||c.edition===filters.edition).filter(c=>!filters.favoritesOnly||c.favorite).filter(c=>!filters.approval||filters.approval==='all'||(filters.approval==='approved'?isCitationApproved(c,filters.settings):!isCitationApproved(c,filters.settings))).flatMap(c=>{
  if(!tokens.length)return [{citation:c,score:0,groupRank:citationGroupRank(c,contextGroups)}];
  const title=new Set(words(c.title));const keywords=new Set(words(c.keywords.join(' ')));const all=new Set(words([c.title,c.code,c.edition,c.section,c.category,c.summary,c.correction,...c.keywords].join(' ')));
  // Keep subject-specific searches from becoming an unrelated list of locations.
  for(const anchor of ['extinguisher','door','sprinkler','alarm','cord','battery'])if(tokens.includes(anchor)&&!(groups[anchor]??[anchor]).some(term=>all.has(term)))return [];
  let matched=0,score=0;
  for(const token of tokens){if(title.has(token)){score+=12;matched++;}else if(keywords.has(token)){score+=10;matched++;}else if(all.has(token)){score+=6;matched++;}else if((groups[token]??[]).some(term=>all.has(term))){score+=4;matched++;}else if(exactOrTypo(token,all)){score+=3;matched++;}}
  const sectionMatch=compact&&[c.section,`${c.code}${c.edition}${c.section}`,`${c.code}${c.section}`].some(value=>value.toLowerCase().replace(/[^a-z0-9.]/g,'').includes(compact));
  if(sectionMatch){score+=50;matched=tokens.length;}
  if(!matched||matched<Math.max(1,Math.ceil(tokens.length*.6)))return [];
  if(c.title.toLowerCase().includes(query.toLowerCase().trim()))score+=20;
  return [{citation:c,score,groupRank:citationGroupRank(c,contextGroups)}];
 });
 return ranked.sort((a,b)=>b.groupRank-a.groupRank||b.score-a.score||Number(!!b.citation.favorite)-Number(!!a.citation.favorite)||a.citation.title.localeCompare(b.citation.title)).map(x=>x.citation);
}

/** Group context changes priority, never silently removes a matching reference. */
export function citationGroupRank(citation:Citation,groups:readonly string[]=[]):number{
 if(!groups.length)return 0;
 if(citation.occupancyGroups?.length)return citation.occupancyGroups.some(group=>groups.includes(group))?3:0;
 if(!citation.occupancies.length)return 2;
 const families=getGroupFamilies([...groups]);
 return citation.occupancies.some(family=>families.includes(family))?1:0;
}
