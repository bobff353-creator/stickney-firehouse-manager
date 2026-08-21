export type ConstructionProfile = {
  constructionType:string;roofType:string;roofSupportSystem:string;lightweightConstruction:"yes"|"no"|"unknown";bowstringTruss:"yes"|"no"|"unknown";
  basementType:string;floorsAboveGrade:number|null;floorsBelowGrade:number|null;fortifiedAccess:"yes"|"no"|"unknown";notes:string;
};

export type OccupancyProfile = {
  classification:string;daytimeOccupancy:number|null;nighttimeOccupancy:number|null;peakOccupancy:number|null;
  nonAmbulatory:"yes"|"no"|"unknown";sleepingOccupants:"yes"|"no"|"unknown";children:"yes"|"no"|"unknown";elderly:"yes"|"no"|"unknown";assistanceNeeded:"yes"|"no"|"unknown";scheduleNotes:string;
};

const choice=(value:unknown):"yes"|"no"|"unknown"=>value==="yes"||value==="no"?value:"unknown";
const text=(value:unknown,limit:number)=>String(value??"").trim().slice(0,limit);
const count=(value:unknown)=>{if(value==null||value==="")return null;const parsed=Number(value);return Number.isInteger(parsed)&&parsed>=0&&parsed<=100000?parsed:null;};

export function parseProfile<T extends Record<string,unknown>>(value:unknown):Partial<T>{
  if(value&&typeof value==="object"&&!Array.isArray(value))return value as Partial<T>;
  try{const parsed=JSON.parse(String(value||"{}"));return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed as Partial<T>:{};}catch{return {};}
}

export function constructionProfile(value:unknown):ConstructionProfile{
  const item=parseProfile<Record<string,unknown>>(value);
  return {constructionType:text(item.constructionType,80),roofType:text(item.roofType,80),roofSupportSystem:text(item.roofSupportSystem,120),lightweightConstruction:choice(item.lightweightConstruction),bowstringTruss:choice(item.bowstringTruss),basementType:text(item.basementType,80),floorsAboveGrade:count(item.floorsAboveGrade),floorsBelowGrade:count(item.floorsBelowGrade),fortifiedAccess:choice(item.fortifiedAccess),notes:text(item.notes,2000)};
}

export function occupancyProfile(value:unknown):OccupancyProfile{
  const item=parseProfile<Record<string,unknown>>(value);
  return {classification:text(item.classification,120),daytimeOccupancy:count(item.daytimeOccupancy),nighttimeOccupancy:count(item.nighttimeOccupancy),peakOccupancy:count(item.peakOccupancy),nonAmbulatory:choice(item.nonAmbulatory),sleepingOccupants:choice(item.sleepingOccupants),children:choice(item.children),elderly:choice(item.elderly),assistanceNeeded:choice(item.assistanceNeeded),scheduleNotes:text(item.scheduleNotes,2000)};
}

export function hasConstructionProfile(profile:ConstructionProfile){return Boolean(profile.constructionType||profile.roofType||profile.roofSupportSystem||profile.basementType||profile.notes||profile.floorsAboveGrade!=null||profile.floorsBelowGrade!=null||[profile.lightweightConstruction,profile.bowstringTruss,profile.fortifiedAccess].some((value)=>value!=="unknown"));}
export function hasOccupancyProfile(profile:OccupancyProfile){return Boolean(profile.classification||profile.scheduleNotes||profile.daytimeOccupancy!=null||profile.nighttimeOccupancy!=null||profile.peakOccupancy!=null||[profile.nonAmbulatory,profile.sleepingOccupants,profile.children,profile.elderly,profile.assistanceNeeded].some((value)=>value!=="unknown"));}
