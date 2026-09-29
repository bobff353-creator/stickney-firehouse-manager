import {getAt,setAt,schemas,type Values,type NerisData,type Json} from './model';

export type CadCall={id:string;callType:string;address:string;city:string;narrative:string;units:string;dispatchedAt:string;source:string};
export type CadLocationSource={id:string;address:string;city:string};
const suffixes=new Set((schemas.TypeLocSnPrePostValue.enum||[]).map(String));
const states=new Set((schemas.StatesTerrs.enum||[]).map(String));
const suffixAbbreviations:Record<string,string>={ST:'STREET',AVE:'AVENUE',AV:'AVENUE',BLVD:'BOULEVARD',RD:'ROAD',DR:'DRIVE',LN:'LANE',CT:'COURT',CIR:'CIRCLE',PL:'PLACE',PKWY:'PARKWAY',HWY:'HIGHWAY',TER:'TERRACE',TRL:'TRAIL',WAY:'WAY'};
const directions=new Set(['N','S','E','W','NE','NW','SE','SW']);
const clean=(v:string)=>v.trim().replace(/\s+/g,' ');
const token=(v:string)=>v.replace(/\.$/,'').toUpperCase();

/** Split only explicit address elements. Uncertain formats stay in the source text. */
export function cadLocation(source:Pick<CadLocationSource,'address'|'city'>):Values {
  const address=clean(source.address||''),city=clean(source.city||''),result:Values={};
  if(address)result.additional_info=address.slice(0,255);
  if(city)result.postal_community=city.slice(0,255);
  let parts=address.split(',').map(clean).filter(Boolean),line=parts.shift()||'';
  // A state/ZIP must be present in a separate address part; never infer from department.
  if(parts.length){const last=parts.at(-1)!,region=last.match(/^([A-Z]{2})(?:\s+(\d{5})(?:-(\d{4}))?)?$/i);if(region&&states.has(region[1].toUpperCase())){result.state=region[1].toUpperCase();if(region[2])result.postal_code=region[2];if(region[3])result.postal_code_extension=region[3];parts=parts.slice(0,-1);}}
  if(parts.length){const last=parts.at(-1)!,region=last.match(/^(.+?)\s+([A-Z]{2})\s+(\d{5})(?:-(\d{4}))?$/i);if(region&&states.has(region[2].toUpperCase())){if(!city||city.toLowerCase()===region[1].toLowerCase()){result.postal_community=city||region[1];result.state=region[2].toUpperCase();result.postal_code=region[3];if(region[4])result.postal_code_extension=region[4];parts=parts.slice(0,-1);}}}
  if(parts.length&&city&&parts.at(-1)!.toLowerCase()===city.toLowerCase())parts=parts.slice(0,-1);
  // Explicit unit labels can occur after a comma. Any other trailing text remains unparsed.
  if(parts.length===1&&/^(?:APT\.?|APARTMENT|UNIT|STE\.?|SUITE|#)\s*[\w-]+$/i.test(parts[0])){line+=` ${parts[0]}`;parts=[];}
  if(parts.length)return result;
  if(/\s(?:&|AND|AT|@)\s|\s\/\s|\b(?:BLOCK|BLK|INTERSECTION|BETWEEN|NEAR|MM|MILE)\b/i.test(line))return result;
  const house=line.match(/^(\d{1,7})([A-Z]|\s+1\/2)?\s+(.+)$/i);
  if(!house||Number(house[1])>1000000)return result;
  let street=house[3];
  const unit=street.match(/\s+(APT\.?|APARTMENT|UNIT|STE\.?|SUITE|#)\s*([\w-]+)$/i);
  if(unit){result.unit_prefix=unit[1].replace(/\.$/,'').toUpperCase();result.unit_value=unit[2];street=street.slice(0,unit.index).trim();}
  let words=street.split(/\s+/);
  if(words.length>2&&directions.has(token(words[0]))){result.street_prefix_direction=token(words.shift()!);}
  if(words.length>2&&directions.has(token(words.at(-1)!))){result.street_postfix_direction=token(words.pop()!);}
  const last=token(words.at(-1)||''),suffix=suffixAbbreviations[last]||(suffixes.has(last)?last:'');
  if(words.length>1&&suffix){result.street_postfix=suffix;words=words.slice(0,-1);}
  if(!words.length||!/[A-Za-z]/.test(words.join(' ')))return {additional_info:address.slice(0,255),...(city?{postal_community:city}:{})};
  result.number=Number(house[1]);if(house[2])result.number_suffix=house[2].trim();
  result.street=words.join(' ').slice(0,255);
  return result;
}

export function hasRecordedLocation(data:NerisData):boolean {
  const filled=(v:Json|undefined):boolean=>v!==null&&v!==undefined&&v!==''&&(typeof v!=='object'||Object.values(v).some(filled));
  return ['base.location','base.point','base.polygon'].some(path=>filled(getAt(data.payload,path)));
}
export function withCadLocation(data:NerisData,source:CadLocationSource):NerisData {
  if(hasRecordedLocation(data))return data;
  const location=cadLocation(source);if(!Object.keys(location).length)return data;
  return {...data,payload:setAt(data.payload,'base.location',location),local:{...data.local,cadLocation:{id:source.id,address:source.address,city:source.city}}};
}

export function recordedDispatchSource(data:NerisData):CadLocationSource|null {
  const location=getAt(data.payload,'dispatch.location');
  if(!location||typeof location!=='object'||Array.isArray(location))return null;
  const address=typeof location.additional_info==='string'?location.additional_info:'';
  const city=typeof location.postal_community==='string'?location.postal_community:'';
  return address?{id:data.local.cadSourceId||String(getAt(data.payload,'dispatch.incident_number')||''),address,city}:null;
}
