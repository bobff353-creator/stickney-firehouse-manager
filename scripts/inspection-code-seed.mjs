import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export const adoptionUrl = 'https://library.municode.com/il/stickney/codes/code_of_ordinances?nodeId=MUCO_CH18BUBURE_ARTIIIBUCO_S18-101ADBUCO';
export const amendmentsUrl = 'https://library.municode.com/il/stickney/codes/code_of_ordinances?nodeId=MUCO_CH18BUBURE_ARTIIIBUCO_S18-102ADINDECH';
export const bookUrl = 'https://www.natchez.ms.us/DocumentCenter/View/1046/2009-International-Building-Code';
const read = name => JSON.parse(readFileSync(new URL('../app/fire-inspections/'+name, import.meta.url), 'utf8'));
const ibc = read('ibc-2009-starter.json'), local = read('stickney-local-starter.json');

export function inspectionStarter() {
  const amended = section => local.some(([s])=>s!=='18-101' && (s===section || s.startsWith(section+'.') || section.startsWith(s+'.')));
  const base = {edition:'2009', jurisdiction:'Village of Stickney, Illinois', effectiveDate:'', frequent:''};
  return [
    ...ibc.map(([section,title,category,page])=>({key:'ibc-2009-'+section.replaceAll('.','-'),data:{...base,type:'IBC',section,title,category,
      text:`Inspection focus: ${title}. Compare the observed condition and approved design with this section, including its exceptions and referenced standards. Record the exact location, supporting measurements or records, and any condition needing correction. This is an inspection prompt, not the complete code text or an issued violation.`,
      sourceUrl:bookUrl+'#page='+page,
      applicability:`IBC 2009 section locator, checked against the source book. Stickney's published adoption is section 18-101 (Ordinance 2015-03). ${amended(section)?'STICKNEY AMENDMENT: read the related local ordinance entries under 18-102(c) before applying this model-code section. ':''}Confirm the applicable edition, occupancy, project scope, state requirements and local approvals. A building's age alone does not establish applicability.`
    }})),
    ...local.map(([section,title,category,text])=>({key:'local-ibc-2009-'+section.replaceAll('.','-'),data:{...base,type:'Local ordinance',section:section==='18-101'?'18-101':`18-102(c) / IBC ${section}`,title,category,text,
      sourceUrl:section==='18-101'?adoptionUrl:amendmentsUrl,
      applicability:'Stickney Ordinance 2015-03, adopted March 17, 2015; codified in the current Municode version dated May 26, 2026. The edition filter is 2009 because this provision adopts or changes IBC 2009. This plain-language reference was checked September 25, 2026. Read the full ordinance and confirm applicability before citing.'
    }}))
  ];
}

// Inserts are department scoped and append only. Reruns preserve edits and archives.
// A citation's original payload and version are written atomically with each entry.
export function inspectionSeedSql(departmentId) {
  if(!/^[a-zA-Z0-9_-]{8,80}$/.test(departmentId))throw Error('A verified department ID is required.');
  const quote = value => "'"+String(value).replaceAll("'","''")+"'";
  const rows = inspectionStarter().map(({key,data})=>`(${quote('ref-'+departmentId+'-'+key)},${quote(JSON.stringify(data))})`).join(',\n');
  return `WITH starter(id,payload) AS (VALUES\n${rows}\n), inserted AS (
    INSERT INTO firehouse.fire_inspection_code_entries(id,department_id,payload,version,archived,updated_at,updated_by)
    SELECT id,${quote(departmentId)},payload,1,0,to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'Verified starter library' FROM starter
    ON CONFLICT(id) DO NOTHING RETURNING *
  ), audited AS (
    INSERT INTO firehouse.fire_inspection_code_audit(id,department_id,code_id,version,payload,archived,actor,created_at)
    SELECT id||'-v1',department_id,id,version,payload,archived,updated_by,updated_at FROM inserted RETURNING code_id
  ) SELECT count(*)::int AS inserted FROM audited;`;
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [, ,departmentId,output]=process.argv;
  if(!output)throw Error('Usage: node scripts/inspection-code-seed.mjs <department-id> <output.sql>');
  writeFileSync(output,inspectionSeedSql(departmentId));
  console.log(`Prepared ${inspectionStarter().length} verified references. No database changes were made.`);
}
