import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {inspectionSeedSql} from './inspection-code-seed.mjs';
export const nfpaBookUrl='https://link.nfpa.org/free-access/publications/101/2027';
export const illinoisAdoptionUrl='https://my.ilga.gov/commission/jcar/admincode/041/041001000000070R.html';
const rows=JSON.parse(readFileSync(new URL('../app/fire-inspections/nfpa-101-2027-starter.json',import.meta.url),'utf8'));
export function nfpaInspectionStarter(){return [
 ...rows.map(([section,title,category,prompt])=>({key:'nfpa-101-2027-'+section.replaceAll('.','-'),data:{type:'NFPA 101',edition:'2027',jurisdiction:'Model code — adoption must be verified',section,title,category,text:`Inspection prompt: ${prompt} This is a section locator and observation aid, not the complete code text or an issued violation.`,sourceUrl:nfpaBookUrl,effectiveDate:'',frequent:'',applicability:'ADOPTION NOT VERIFIED: NFPA 101 (2027), checked in the publisher’s free-access reader on September 25, 2026. Open the table of contents and select the listed section. This pack does not establish adoption in Stickney. Illinois 41 Ill. Adm. Code 100.7 references NFPA 101 (2015), with modifications; local jurisdiction and scope must also be reviewed. Check the governing occupancy chapter, new/existing classification, exceptions, amendments, and referenced standards. Confirm the applicable edition and exact subsection before citing.'}})),
 {key:'illinois-nfpa-101-adoption-100-7',data:{type:'State rule',edition:'2015',jurisdiction:'Illinois OSFM',section:'41 Ill. Adm. Code 100.7',title:'Illinois NFPA 101 adoption and modifications',category:'Adoption and applicability',text:'Illinois OSFM incorporates NFPA 101 (2015) with specified modifications. Certain provisions reference the 2000 edition. Later editions are not automatically incorporated. Read the rule and determine the responsible authority and applicable scope before selecting a building’s code basis.',sourceUrl:illinoisAdoptionUrl,effectiveDate:'',frequent:'',applicability:'Read this with sections 100.3 and 100.9 concerning jurisdiction, equivalency, and later editions. This reference does not decide which requirements govern an individual Stickney property. Verified September 25, 2026.'}}
];}
export const nfpaInspectionSeedSql=departmentId=>inspectionSeedSql(departmentId,nfpaInspectionStarter());
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [,,departmentId,output]=process.argv;if(!output)throw Error('Usage: node scripts/inspection-nfpa-seed.mjs <department-id> <output.sql>');
 writeFileSync(output,nfpaInspectionSeedSql(departmentId));console.log('Prepared 25 NFPA 101 prompts and one Illinois adoption reference. No database changes were made.');
}
