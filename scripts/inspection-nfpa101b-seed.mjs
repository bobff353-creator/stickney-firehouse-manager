import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {inspectionSeedSql} from './inspection-code-seed.mjs';
export const nfpa101bBookUrl='https://link.nfpa.org/free-access/publications/101b/2002';
const rows=JSON.parse(readFileSync(new URL('../app/fire-inspections/nfpa-101b-2002-starter.json',import.meta.url),'utf8'));
export function nfpa101bInspectionStarter(){return rows.map(([section,title,category,prompt])=>({
 key:'nfpa-101b-2002-'+section.replaceAll('.','-'),
 data:{type:'NFPA 101B',edition:'2002',jurisdiction:'Model code — adoption must be verified',section,title,category,
 text:`Inspection prompt: ${prompt} This is a section locator and observation aid, not the complete code text or an issued violation.`,
 sourceUrl:nfpa101bBookUrl,effectiveDate:'',frequent:'',
 applicability:'ADOPTION NOT VERIFIED: NFPA 101B (2002), Code for Means of Egress for Buildings and Structures. Section locators checked in the publisher’s free-access reader on September 25, 2026. This is a separate reference from NFPA 101 and NFPA 101A; it does not establish adoption in Stickney. Chapter 5 addresses new construction. Chapter 7 addresses alterations, repairs or changes of occupancy in existing structures. Confirm the applicable authority, edition, occupancy, project scope, exceptions and amendments before citing. An older building does not automatically qualify for this edition.'}
}));}
export const nfpa101bInspectionSeedSql=departmentId=>inspectionSeedSql(departmentId,nfpa101bInspectionStarter());
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [,,departmentId,output]=process.argv;if(!output)throw Error('Usage: node scripts/inspection-nfpa101b-seed.mjs <department-id> <output.sql>');
 writeFileSync(output,nfpa101bInspectionSeedSql(departmentId));console.log('Prepared 21 NFPA 101B 2002 egress prompts. No database changes were made.');
}
