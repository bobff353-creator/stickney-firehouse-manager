
export type OccupancyGroup = {
  code:string;
  family:string;
  familyLabel:string;
  name:string;
  label:string;
  description:string;
  examples:string[];
  families:string[];
  authorityGate?:string;
  section2009:string;
  section2024:string;
  sourceUrls:string[];
};


export const OCCUPANCY_CLASSIFICATION_SOURCES=[
  {id:'icc-ibc2009-classification',edition:'2009',title:'ICC 2009 IBC classification chapter — publisher text in ANSI preview',url:'https://webstore.ansi.org/preview-pages/ICC/preview_ICC%2BIBC-2009.pdf'},
  {id:'icc-ibc2024-classification',edition:'2024',title:'ICC 2024 IBC classification chapter — publisher sample',url:'https://shop.iccsafe.org/media/wysiwyg/material/3000S24-Sample.pdf'},
  {id:'icc-ibc2024-commentary',edition:'2024',title:'ICC 2024 IBC commentary — group structure and classification context',url:'https://shop.iccsafe.org/media/wysiwyg/material/3010S241-Sample.pdf'},
] as const;
export const OCCUPANCY_GROUP_NOTE='ICC group descriptions are selection aids. Confirm the building or space classification, adopted edition, local amendments and approved records. Care capability, occupant load, quantities, accessory uses and exceptions affect classification. ICC groups and NFPA occupancy names are separate systems; an app selection does not establish legal approval.';

const CARE='Confirm the facility license, inspection purpose, responsible Illinois agency, resident care and evacuation capabilities, and the adopted-edition conditions. These prompts do not replace an IDPH, OSFM or other required licensing survey.';
const HAZARD='Confirm the approved hazardous-material inventory, control-area and quantity analysis, design basis and permits with the qualified reviewer. A material name or hazard label alone does not determine a Group H classification.';

type Definition=[string,string,string,string[],string[],string,string,string?];
const definitions:Definition[]=[
  ['A-1','Assembly: performance and cinema','Audience venues for performances or films.',['Theater','Concert venue'],['Assembly'],'303.1','303.2'],
  ['A-2','Assembly: dining and drinking','Gathering spaces centered on food or drinks.',['Restaurant','Banquet venue','Bar'],['Restaurant','Assembly'],'303.1','303.3'],
  ['A-3','Assembly: worship, recreation and community','Other gathering uses within the assembly category.',['Place of worship','Community hall','Museum'],['Assembly'],'303.1','303.4'],
  ['A-4','Assembly: indoor spectator sports','Indoor sporting activities with spectator seating.',['Arena','Spectator gymnasium'],['Assembly'],'303.1','303.5'],
  ['A-5','Assembly: outdoor activities','Outdoor participation and audience structures.',['Grandstand','Stadium'],['Assembly'],'303.1','303.6'],
  ['B','Business: offices and services','Professional, administrative and service transactions.',['Office','Salon','Outpatient clinic where classified'],['Small business','Large business','Healthcare'],'304.1','304.1','Verify the actual service, training, laboratory or ambulatory-care use. Special provisions may apply within Group B; a small assembly exception must be confirmed rather than assumed.'],
  ['E','Educational: schools and qualifying daycare','School instruction and qualifying child-care settings.',['School','Qualifying daycare'],['Educational','Daycare'],'305','305',"Confirm school inspection authority and licensing requirements. Daycare uses also require the applicable OSFM/DCFS licensing scope and guides."],
  ['F-1','Factory: moderate hazard','Manufacturing with moderate combustion hazards.',['Woodworking','Manufacturing workshop'],['Industrial'],'306.2','306.2'],
  ['F-2','Factory: low hazard','Manufacturing with a lower combustion hazard.',['Qualified noncombustible-product processing'],['Industrial'],'306.3','306.3'],
  ['H-1','High hazard: detonation','Material hazards involving possible detonation.',['Approved detonable-material operation'],['Industrial','Warehouse'],'307.3','307.3',HAZARD],
  ['H-2','High hazard: deflagration or rapid burning','Material hazards involving very rapid combustion.',['Approved flammable-gas or dust process'],['Industrial','Warehouse'],'307.4','307.4',HAZARD],
  ['H-3','High hazard: physical or combustion hazards','Materials with specified physical or combustion hazards.',['Approved oxidizer or flammable-solid storage'],['Industrial','Warehouse'],'307.5','307.5',HAZARD],
  ['H-4','High hazard: health hazards','Material hazards affecting human health.',['Approved toxic or corrosive-material operation'],['Industrial','Warehouse'],'307.6','307.6',HAZARD],
  ['H-5','High hazard: semiconductor HPM','Semiconductor work using hazardous production materials.',['Qualified semiconductor fabrication facility'],['Industrial'],'307.7','307.7',HAZARD],
  ['I-1','Institutional: supervised residential care','Supervised residential settings providing care.',['Qualifying assisted-living facility'],['Assisted living'],'308.2','308.2',CARE],
  ['I-2','Institutional: medical and nursing care','Care settings with assisted self-preservation needs.',['Hospital','Qualifying nursing facility'],['Healthcare'],'308.3','308.3',CARE],
  ['I-3','Institutional: detention and restraint','Supervised detention with restricted occupant movement.',['Detention facility','Correctional facility'],['Mixed use'],'308.4','308.4','Confirm the detention condition, authorized inspection scope and approved security, release and relocation arrangements with the responsible agency. Generic free-egress assumptions must not override approved detention controls.'],
  ['I-4','Institutional: custodial daycare','Daytime custodial care for qualifying recipients.',['Qualifying adult or child daycare'],['Daycare'],'308.5','308.5','Confirm adult versus child care, recipient needs, floor of care, approved classification and responsible licensing agency. Child daycare uses require the applicable OSFM/DCFS guide and authorized licensing workflow. A local-code visit does not establish licensing clearance.'],
  ['M','Mercantile: retail and sales','Public merchandise display and sales.',['Shop','Market','Sales floor'],['Retail / Mercantile'],'309','309'],
  ['R-1','Residential: transient lodging','Sleeping accommodations for transient occupants.',['Hotel','Motel'],['Hotel / Lodging'],'310.1','310.2'],
  ['R-2','Residential: apartments and permanent lodging','Multiunit or other qualifying nontransient living.',['Apartment building','Dormitory where classified'],['Apartments'],'310.1','310.3'],
  ['R-3','Residential: smaller dwellings and lodging','Dwelling or smaller residential arrangements.',['Qualified dwelling or boarding arrangement'],['Apartments'],'310.1','310.4','Confirm IBC versus IRC applicability, the actual residential or care use and lawful access. Do not apply dwelling-unit inspection prompts to areas outside the authorized scope.'],
  ['R-4','Residential: supervised residential care','Qualifying residential care with a smaller scale.',['Qualifying residential board-and-care home'],['Assisted living'],'310.1','310.5',CARE],
  ['S-1','Storage: moderate hazard','Storage with moderate combustion hazards.',['Combustible commodity warehouse'],['Warehouse'],'311.2','311.2'],
  ['S-2','Storage: low hazard','Storage with a lower combustion hazard.',['Qualified noncombustible goods storage','Parking garage where classified'],['Warehouse'],'311.3','311.3'],
  ['U','Utility and miscellaneous','Qualifying accessory and miscellaneous structures.',['Utility structure','Qualifying agricultural structure'],['Mixed use'],'312','312'],
];
const familyLabels:Record<string,string>={A:'Assembly',B:'Business',E:'Educational',F:'Factory and industrial',H:'High hazard',I:'Institutional',M:'Mercantile',R:'Residential',S:'Storage',U:'Utility and miscellaneous'};

export const OCCUPANCY_GROUPS:readonly OccupancyGroup[]=definitions.map(([code,name,description,examples,families,section2009,section2024,authorityGate])=>({code,family:code[0],familyLabel:familyLabels[code[0]],name,label:code+' — '+name,description,examples:[...examples],families:[...families],section2009,section2024,sourceUrls:[OCCUPANCY_CLASSIFICATION_SOURCES[0].url,OCCUPANCY_CLASSIFICATION_SOURCES[1].url],...(authorityGate?{authorityGate}:{} )}));
const groupByCode=new Map(OCCUPANCY_GROUPS.map(group=>[group.code,group]));

/** Accept code formatting only. Never infer classification from names or legacy free text. */
export function getOccupancyGroup(value:unknown):OccupancyGroup|undefined {
  if(typeof value!=='string')return undefined;
  const code=value.trim().toUpperCase().replace(/^([AFHIRS])([1-5])$/,'$1-$2');
  return groupByCode.get(code);
}
export function normalizeGroupCodes(values:readonly unknown[]):string[] {
  return [...new Set((Array.isArray(values)?values:[]).flatMap(value=>{const group=getOccupancyGroup(value);return group?[group.code]:[];}))];
}
export function normalizeOccupancyGroups(property:unknown):string[] {
  if(!property||typeof property!=='object'||Array.isArray(property))return [];
  if((property as {recordStatus?:unknown}).recordStatus==='draft')return [];
  const record=property as {occupancyGroup?:unknown;additionalOccupancyGroups?:unknown};
  return normalizeGroupCodes([record.occupancyGroup,...(Array.isArray(record.additionalOccupancyGroups)?record.additionalOccupancyGroups:[])]);
}
/** Friendly research-family matches aid search coverage, not legal applicability. */
export function getGroupFamilies(groups:readonly string[]):string[] {
  return [...new Set(normalizeGroupCodes(groups).flatMap(code=>getOccupancyGroup(code)!.families))];
}
