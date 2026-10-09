import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {bookUrl,inspectionSeedSql,inspectionStarter} from './inspection-code-seed.mjs';
import {nfpaBookUrl,nfpaInspectionStarter} from './inspection-nfpa-seed.mjs';
import {nfpa101bBookUrl,nfpa101bInspectionStarter} from './inspection-nfpa101b-seed.mjs';

const read=name=>JSON.parse(readFileSync(new URL('../app/fire-inspections/'+name,import.meta.url),'utf8'));
const verified='2026-10-08';
const base={jurisdiction:'Village of Stickney, Illinois',effectiveDate:'',frequent:''};
const key=(type,edition,section)=>'expansion-'+type+'-'+edition+'-'+section.replace(/[^a-zA-Z0-9]+/g,'-');
const observation=title=>`Inspection prompt: ${title}. Read the linked section before evaluating the observed condition. Record the location, measurements, approved plans or test records needed for that review. This reference does not supply the complete requirements, exceptions or an automatic violation.`;

export function inspectionExpansion(){
 const local=read('stickney-local-expansion.json');
 const amended=section=>inspectionStarter().some(r=>r.data.type==='Local ordinance'&&r.data.section.includes(' / IBC ')&&(r.data.section.endsWith(' / IBC '+section)||section.startsWith(r.data.section.split(' / IBC ')[1]+'.')));
 const rows=[
  ...read('ibc-2009-expansion.json').map(([section,title,category,page])=>({key:key('ibc','2009',section),data:{...base,type:'IBC',edition:'2009',section,title,category,text:observation(title),sourceUrl:bookUrl+'#page='+page,applicability:`IBC 2009 section verified in the published source book, PDF page ${page}, on ${verified}. Stickney section 18-101 adopts IBC 2009 with local changes in 18-102. ${amended(section)?'STICKNEY AMENDMENT: read the related local changes before applying this section. ':''}Confirm occupancy, project scope, exceptions, state rules and authority approval before citing.`}})),
  ...read('nfpa-101-2027-expansion.json').map(([section,title,category])=>({key:key('nfpa-101','2027',section),data:{...base,type:'NFPA 101',edition:'2027',section,title,category,text:observation(title),sourceUrl:nfpaBookUrl,applicability:`ADOPTION NOT VERIFIED: NFPA 101 (2027) section identity and topic verified in the publisher's final-edition contents on ${verified}. This is a section locator with an original observation aid. Illinois section 100.7 incorporates the 2015 edition with modifications. Review the complete applicable occupancy chapter, new/existing conditions, exceptions and governing authority before citing. The 2027 reference is not marked as adopted by Stickney.`}})),
  ...read('nfpa-101b-2002-expansion.json').map(([section,title,category,page])=>({key:key('nfpa-101b','2002',section),data:{...base,type:'NFPA 101B',edition:'2002',section,title,category,text:observation(title),sourceUrl:nfpa101bBookUrl,applicability:`ADOPTION NOT VERIFIED: NFPA 101B (2002) section identity and subject checked directly in the publisher's final-edition reader, viewer page ${page}, on ${verified}. Chapter 5 addresses new construction; Chapter 7 addresses alterations, repairs and changes of occupancy in existing structures. Read the full section, exceptions and occupancy-specific conditions, and verify the applicable authority before citing. This is distinct from NFPA 101 and is not marked as adopted by Stickney.`}})),
  ...local.map(([section,title,category,text,sourceUrl,source])=>({key:key('local','municipal',section),data:{...base,type:'Local ordinance',edition:section.includes(' / IFC ')?'2009':'Municipal version 2026-05-26',section,title,category,text:`Published municipal provision:\n${text}`,sourceUrl,applicability:`Village of Stickney, Illinois, published municipal code version May 26, 2026; exact section or numbered clause checked on ${verified}. ${source==='stickney-radio'?'Radio provisions are from Ordinance 2021-25. Read section 18-365 exemptions and the complete article. Published cross-reference and monitoring wording is retained; obtain authority clarification where provisions conflict. ':section.includes(' / IFC ')?'Section 34-2(6) changes the adopted IFC 2009 under Ordinance 2015-02. This is an IFC amendment, separate from the IBC changes in 18-102(c). ':''}Review the complete section, exceptions, current state requirements and authority jurisdiction before applying. No effective date is assumed from the codification date.`}}))
 ];
 const previous=[...inspectionStarter(),...nfpaInspectionStarter(),...nfpa101bInspectionStarter()];
 const identity=r=>[r.data.type,r.data.edition,r.data.section].join('|');
 const known=new Set(previous.map(identity)),seen=new Set(),keys=new Set();
 for(const r of rows){if(known.has(identity(r))||seen.has(identity(r))||keys.has(r.key))throw Error('Duplicate code locator: '+identity(r));seen.add(identity(r));keys.add(r.key);}
 for(const type of ['IBC','NFPA 101','NFPA 101B','Local ordinance'])if(rows.filter(r=>r.data.type===type).length!==150)throw Error('Expected 150 additions for '+type);
 if(rows.length!==600)throw Error('Expected 600 additions.');
 return rows;
}
export const inspectionExpansionSql=departmentId=>inspectionSeedSql(departmentId,inspectionExpansion());
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [,,departmentId,output]=process.argv;if(!output)throw Error('Usage: node scripts/inspection-code-expansion.mjs <department-id> <output.sql>');
 writeFileSync(output,inspectionExpansionSql(departmentId));console.log('Prepared '+inspectionExpansion().length+' verified additive references; no database changes made.');
}
