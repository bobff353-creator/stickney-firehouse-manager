import type {InspectionCheck} from './model';
export type WalkthroughFilter='All'|'Unanswered'|'Findings'|'Not inspected';
export function walkthroughChecks(checks:InspectionCheck[],{filter='All',section='',query=''}:{filter?:WalkthroughFilter;section?:string;query?:string}={}){
 const terms=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
 return checks.filter(c=>(!section||c.section===section)&&(filter==='All'||filter==='Unanswered'&&c.result==='Not checked'||filter==='Findings'&&['Needs attention','Corrected on site','Resolved'].includes(c.result)||filter==='Not inspected'&&c.result==='Not inspected')&&terms.every(term=>`${c.label} ${c.section} ${c.location} ${c.observation} ${c.code}`.toLowerCase().includes(term)));
}
export function walkthroughProgress(checks:InspectionCheck[]){return {total:checks.length,answered:checks.filter(c=>c.result!=='Not checked').length,unanswered:checks.filter(c=>c.result==='Not checked').length,open:checks.filter(c=>c.result==='Needs attention').length,notInspected:checks.filter(c=>c.result==='Not inspected').length,findings:checks.filter(c=>['Needs attention','Corrected on site','Resolved'].includes(c.result)).length};}
/** Preserve source order and exact occurrence IDs; never wrap Back to the end. */
export function adjacentCheckpoint(checks:InspectionCheck[],currentId:string,direction:-1|1){const index=checks.findIndex(c=>c.id===currentId);if(index<0)return direction===1?checks[0]?.id??'':'';return checks[index+direction]?.id??'';}
export function checkpointGaps(c:InspectionCheck){const gaps:string[]=[];
 if(c.result==='Not checked')return ['Choose a result, including Not inspected when access was unavailable.'];
 if(['Needs attention','Corrected on site','Resolved'].includes(c.result)){if(!c.location.trim())gaps.push('Exact location');if(!c.observation.trim())gaps.push('Observed condition');if(!c.correction.trim())gaps.push('Correction / action');if(!c.code.trim()&&!c.citations?.length)gaps.push('Verified code reference');}
 if(c.result==='Needs attention'&&!c.dueDate)gaps.push('Correction due date');
 if(['Corrected on site','Resolved'].includes(c.result)&&!c.correctedDate)gaps.push('Corrected date');
 if(c.result==='Not inspected'&&!c.observation.trim())gaps.push('Reason not inspected');
 return gaps;
}
/** A checklist change cannot detach an existing signed image fingerprint. */
export function retainPhotographedChecks(current:InspectionCheck[],replacement:InspectionCheck[],manifest:{checkId:string}[]){const protectedIds=new Set(manifest.map(photo=>photo.checkId).filter(Boolean)),originals=new Map(current.filter(check=>protectedIds.has(check.id)).map(check=>[check.id,check]));const result=replacement.map(check=>originals.get(check.id)??check),seen=new Set(result.map(check=>check.id));for(const [id,check]of originals)if(!seen.has(id)){result.push(check);seen.add(id);}if(result.length>200)throw Error('This change would exceed 200 checkpoints while preserving existing photo evidence. Keep this visit’s checklist and use a separate inspection for the additional scope.');return result;}
