import directory from './nfpa-directory.json';
import { blankSignature, freshCheck, type InspectionData } from './model';

export const referenceGroups = ['Routine walkthrough', 'Systems, when present', 'Special hazards', 'Plans & specialist review'] as const;
type Group = typeof referenceGroups[number];
type Guide = { group: Group; topic: string; keywords: string; prompt: string; reading?: string };
// Original research/observation prompts. These are not transcribed code requirements.
const guides: Record<string, Guide> = {
 'NFPA 1': {group:'Routine walkthrough',topic:'Fire prevention and property use',keywords:'general inspection business fire code permits housekeeping access',prompt:'Record property use, permit questions, and conditions needing fire-code research.'},
 'NFPA 101': {group:'Routine walkthrough',topic:'Exits and life safety',keywords:'egress exit escape occupant load doors lighting signs occupancy',prompt:'Record the occupancy, exit routes, door operation, signs, and emergency-lighting concerns for the applicable occupancy chapter.'},
 'NFPA 10': {group:'Routine walkthrough',topic:'Portable extinguishers',keywords:'extinguisher extinguishers gauge pin tag monthly service recharge',prompt:'Record extinguisher location, access, visible condition, gauge indication, and inspection or service documentation.',reading:'2026 reading guide: 7.2 covers inspection; 7.3 covers maintenance. Check the chosen edition before citing a section.'},
 'NFPA 70': {group:'Routine walkthrough',topic:'Electrical hazards',keywords:'nec panel panels outlets extension cord power strip wiring breaker',prompt:'Record visible electrical concerns and their locations for review against the applicable electrical code. Refer technical evaluation to qualified personnel.'},
 'NFPA 80': {group:'Routine walkthrough',topic:'Fire doors and opening protection',keywords:'fire door doors closer latch wedge damper shutters rated openings',prompt:'Record fire-door identification, apparent damage, operation concerns, and available inspection records.'},
 'NFPA 25': {group:'Systems, when present',topic:'Sprinkler and water-system service records',keywords:'sprinkler sprinklers standpipe riser valves valve fdc impairment itm testing maintenance hydrostatic',prompt:'Record the water-based systems present, service-report dates, unresolved deficiencies, and reported impairments. Verify the required follow-up for each system.'},
 'NFPA 72': {group:'Systems, when present',topic:'Alarm and signaling systems',keywords:'alarm alarms smoke detector detection panel monitoring trouble supervisory carbon monoxide',prompt:'Record alarm-panel condition, test-report dates, monitoring contacts, and unresolved system issues.'},
 'NFPA 96': {group:'Systems, when present',topic:'Commercial kitchen hoods',keywords:'hood hoods restaurant kitchen cooking grease duct cleaning exhaust',prompt:'Record cooking equipment and hood or duct cleaning documentation. Track cleaning separately from suppression-system service.'},
 'NFPA 17A': {group:'Systems, when present',topic:'Wet-chemical suppression',keywords:'hood kitchen restaurant ansul wet chemical suppression nozzle appliance pull',prompt:'Record the wet-chemical system, appliance arrangement, service documentation, and unresolved deficiencies.'},
 'NFPA 105': {group:'Systems, when present',topic:'Smoke doors and barriers',keywords:'smoke door doors barrier damper opening protection',prompt:'Record smoke-door or opening-protection identification, observed condition, and available inspection documentation.'},
 'NFPA 110': {group:'Systems, when present',topic:'Emergency and standby power',keywords:'generator generators emergency standby power transfer switch fuel testing',prompt:'Identify the emergency or standby power system and record available inspection, testing, and service documentation.'},
 'NFPA 2001': {group:'Systems, when present',topic:'Clean-agent suppression',keywords:'clean agent server room computer gaseous suppression',prompt:'Identify protected spaces and record clean-agent system documentation, service reports, and unresolved issues.'},
 'NFPA 30': {group:'Special hazards',topic:'Flammable and combustible liquids',keywords:'liquid liquids solvent paint fuel flammable combustible cabinet storage',prompt:'Record liquid types, containers, quantities, storage locations, and available permits or safety data sheets for review.'},
 'NFPA 30A': {group:'Special hazards',topic:'Fuel dispensing and repair garages',keywords:'gas station service station auto repair garage mechanic vehicle gasoline diesel',prompt:'Record dispensing or vehicle-repair activities, fuel types, and the permits and safety-system documentation available.'},
 'NFPA 33': {group:'Special hazards',topic:'Spray booths and spray finishing',keywords:'spray paint booth finishing coating body shop ventilation',prompt:'Identify spray-finishing operations and record ventilation, suppression, and permit documentation for specialist review.'},
 'NFPA 51B': {group:'Special hazards',topic:'Hot work',keywords:'welding cutting torch grinding hot work permit fire watch',prompt:'Record hot-work activities, the authorization process, and documented fire-prevention arrangements.'},
 'NFPA 54': {group:'Special hazards',topic:'Fuel-gas equipment',keywords:'natural gas fuel gas appliance furnace boiler piping',prompt:'Identify fuel-gas equipment and record visible concerns, approved information, and the qualified party responsible for follow-up.'},
 'NFPA 55': {group:'Special hazards',topic:'Compressed gases and cryogenic fluids',keywords:'gas gases cylinder cylinders compressed oxygen nitrogen cryogenic tank',prompt:'Record gas types, container quantities, storage locations, labels, and safety data sheets for review.'},
 'NFPA 58': {group:'Special hazards',topic:'Propane and LP-gas',keywords:'propane lpg lp gas cylinder cylinders grill tank',prompt:'Record LP-gas containers, use, placement, and available installation or service documentation.'},
 'NFPA 99': {group:'Special hazards',topic:'Health-care systems',keywords:'health healthcare medical dental clinic hospital oxygen patient',prompt:'Record the health-care activities and systems present, then identify the applicable specialist review and supporting records.'},
 'NFPA 241': {group:'Special hazards',topic:'Construction and demolition',keywords:'construction renovation demolition alteration temporary fire watch',prompt:'Record the work phase and documented arrangements for fire prevention, access, egress, and protection systems during construction.'},
 'NFPA 400': {group:'Special hazards',topic:'Hazardous materials',keywords:'hazmat hazardous materials chemicals inventory oxidizer corrosive storage sds',prompt:'Record hazardous-material inventory, quantities, safety data sheets, permits, and items needing specialist review.'},
 'NFPA 660': {group:'Special hazards',topic:'Combustible dust',keywords:'combustible dust wood grain metal powder collector explosion manufacturing',prompt:'Identify dust-producing operations and available hazard-analysis or control documentation. Refer uncertain conditions for specialist review.'},
 'NFPA 704': {group:'Special hazards',topic:'Hazard identification placards',keywords:'placard placards diamond hazard hazmat marking sign labeling',prompt:'Compare observed hazard-identification markings with available material information and document questions requiring review.'},
 'NFPA 855': {group:'Special hazards',topic:'Stationary battery energy storage',keywords:'battery batteries lithium ion energy storage ess bess solar stationary',prompt:'Identify stationary energy-storage equipment and record installation, emergency-response, and service documentation for review.'},
 'NFPA 13': {group:'Plans & specialist review',topic:'Sprinkler installation and changes',keywords:'sprinkler installation design changes remodel storage commodity rack plans',prompt:'Compare observed sprinkler-system changes with available approved plans; identify questions for qualified design or acceptance review.'},
 'NFPA 14': {group:'Plans & specialist review',topic:'Standpipe installation',keywords:'standpipe hose riser installation design plans fdc',prompt:'Identify standpipe-system arrangements and the approved plans or acceptance documentation available for review.'},
 'NFPA 20': {group:'Plans & specialist review',topic:'Fire-pump installation',keywords:'pump fire pump installation design acceptance plans',prompt:'Identify the fire-pump installation and available plans or acceptance documentation. Use the maintenance reference for ongoing service review.'},
 'NFPA 90A': {group:'Plans & specialist review',topic:'Ventilation-system installation',keywords:'hvac ventilation air conditioning ducts damper duct smoke',prompt:'Record ventilation-system changes and available approved plans, including questions about fire or smoke protection.'},
 'NFPA 4': {group:'Plans & specialist review',topic:'Integrated life-safety testing',keywords:'integrated testing interconnected systems acceptance sequence smoke control',prompt:'Identify interconnected life-safety systems and available integrated-test documentation, including unresolved interface issues.'},
 'NFPA 101A': {group:'Plans & specialist review',topic:'Alternative life-safety evaluation',keywords:'alternative equivalency equivalent fses worksheets evaluation',prompt:'Use the inspection’s Alternative Safety Review to document the proposed approach, evidence, accepted editions, and authority decision. No score or approval is assumed.'},
 'NFPA 101B': {group:'Plans & specialist review',topic:'Historic means-of-egress reference',keywords:'historic old legacy egress exit doors building construction',prompt:'Confirm whether the 2002 means-of-egress reference applies to this project before using it. It is separate from NFPA 101.'},
};
export type NfpaReference = {number:string;title:string;url:string;directoryPage:number;listedEdition?:string;editions?:{year:string;url:string}[];guide?:Guide};
export const nfpaDirectory: NfpaReference[] = directory.entries.map(entry=>({...entry,guide:guides[entry.number]}));
export const nfpaDirectoryCheckedOn = directory.checkedOn;
export const nfpaDirectoryUrl = directory.directoryUrl;
const normalize=(value:string)=>value.toLowerCase().replace(/nfpa\s*[-–]?\s*/g,'nfpa ').replace(/[^a-z0-9]+/g,' ').trim();
export function searchNfpa(query:string,group='',all=false):NfpaReference[]{
 const terms=normalize(query).split(/\s+/).filter(Boolean);
 // An exact document number must not confuse 10 with 101 or 101A.
 const number=normalize(query).match(/^(?:nfpa )?(\d+[a-z]?)$/)?.[1];
 return nfpaDirectory.filter(ref=>{
  if(group&&ref.guide?.group!==group)return false;
  if(!query.trim()&&!all&&!ref.guide)return false;
  if(number)return normalize(ref.number)===`nfpa ${number}`;
  const haystack=normalize(`${ref.number} ${ref.title} ${ref.guide?.topic||''} ${ref.guide?.keywords||''}`);
  return terms.every(term=>haystack.includes(term));
 }).sort((a,b)=>Number(Boolean(b.guide))-Number(Boolean(a.guide))||a.number.localeCompare(b.number,undefined,{numeric:true}));
}
export function nfpaSource(ref:NfpaReference,year:string){
 const edition=ref.editions?.find(e=>e.year===year);
 if(!ref.guide||!edition)throw Error('Choose a verified research edition for an inspection reference.');
 return `NFPA reference: ${ref.number} · ${year}\n${ref.title}\nResearch edition only; local adoption and applicability are not verified. Original observation prompt, not an enforceable citation.\n${ref.guide.prompt}\n${ref.guide.reading||''}\nOfficial reference: ${ref.url}\nFree view: ${edition.url}`;
}
export type NfpaChoice={number:string;year:string};
export function addNfpaCheckpoints(data:InspectionData,choices:NfpaChoice[],makeId:()=>string):InspectionData{
 const sources=new Set(data.checks.map(c=>c.source));
 const additions=choices.flatMap(choice=>{
  const ref=nfpaDirectory.find(r=>r.number===choice.number);
  if(!ref?.guide)throw Error('Choose an inspection reference from the finder.');
  const source=nfpaSource(ref,choice.year);
  if(sources.has(source))return [];
  sources.add(source);
  return [freshCheck({id:makeId(),section:'NFPA reference',label:ref.guide.topic,source})];
 });
 if(!additions.length)return data;
 if(data.checks.length+additions.length>200)throw Error('An inspection can contain up to 200 checkpoints. Remove some checks before adding these.');
 return {...data,sections:[...new Set([...data.sections,'NFPA reference'])],checks:[...data.checks,...additions],representative:blankSignature(),inspectorSignature:blankSignature(),inspectorAttested:false};
}
