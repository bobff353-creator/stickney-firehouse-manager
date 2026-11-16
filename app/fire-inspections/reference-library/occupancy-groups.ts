import {buildResearchedChecklist,getChecklistProfile,type ResearchedChecklistItem,type ResearchSource} from './researched-checklists';

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
export type GroupChecklistItem = ResearchedChecklistItem & {occupancyGroup?:string};

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
  ['E','Educational: schools and qualifying daycare','School instruction and qualifying child-care settings.',['School','Qualifying daycare'],['Educational','Daycare'],'305','305',getChecklistProfile('Educational').authorityGate+' Daycare uses also require the applicable OSFM/DCFS licensing scope and guides.'],
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

type Prompt=[string,string,string];
const prompts:Record<string,Prompt[]>={
  'A-1':[
    ['audience-plan','Compare the audience seating and performance use with approved plans.','Record the rooms, seating arrangement and approved occupant-load information; refer unapproved layout or use changes for review.'],
    ['audience-aisles','Review seating aisles, cross aisles and lobby exit routes.','Include audience approach paths and access from seating sections. Use the adopted requirements and approved layout for measurements.'],
    ['stage-storage','Review stage, scenery and backstage storage conditions.','Record accessible curtains, scenery, storage and protective features within scope. Specialist testing or design review must be assigned separately.'],
    ['effects','Identify theatrical effects and their approval or system coordination.','Document haze, flame, pyrotechnic or other effects if present, and the responsible permit or technical reviewer. Never assume a detection shutdown is acceptable.'],
    ['audience-response','Review staff evacuation and audience-notification arrangements.','Confirm who directs occupants, assists those needing help and responds to an alarm or protection-system impairment.'],
  ],
  'A-2':[
    ['dining-layout','Compare dining, bar and standing areas with the approved use and layout.','Record the operating arrangement and approved occupant-load documentation; identify newly occupied rooms or event arrangements.'],
    ['furnishings','Review tables, chairs, queues and service stations along exit routes.','Inspect the arrangement in use, including movable furnishings and seasonal areas, against applicable approved egress requirements.'],
    ['cooking-scope','Confirm cooking operations and the approved appliance-protection layout.','Identify the hood and suppression scope, changes to appliances and responsible service records. Add the cooking system section when that equipment is recorded.'],
    ['flame-decor','Review decorative, open-flame and fuel-use activities.','Record candles, decorative materials and temporary event equipment for applicable approval review; no universal prohibition or numeric limit is assumed.'],
    ['staff-response','Review staff responsibilities during occupied food or drink service.','Confirm evacuation, notification and impairment actions for the actual operating hours and use.'],
  ],
  'A-3':[
    ['activity','Confirm the current gathering activities and approved room configurations.','Identify worship, community, recreation, exhibition or other uses and any changes from approved plans.'],
    ['room-layout','Review movable seating, partitions and paths through gathering rooms.','Include event layouts and ancillary rooms in the agreed scope; use the applicable approved occupancy and egress information.'],
    ['decor-displays','Review decorations, displays and temporary platforms.','Record conditions and any approval needed for the actual materials, arrangement and activity.'],
    ['accessory-uses','Identify childcare, kitchens, stages or other associated uses needing review.','Record where an associated activity needs a separate module or classification decision; do not automatically assign a second legal occupancy.'],
    ['event-response','Review emergency plans and responsible staff for gatherings.','Confirm who manages exit availability, alerts occupants and assists evacuation for routine and special events.'],
  ],
  'A-4':[
    ['spectator-plan','Compare spectator seating and event arrangements with approved plans.','Record the seating sections, activity area and approved occupant-load documentation.'],
    ['spectator-routes','Review spectator aisles, section exits, stairs and concourse routes.','Include the routes used under the current seating arrangement and identify any blocked or changed paths.'],
    ['under-seating','Review accessible spaces below seating and related separation features.','Record storage, waste and visible protective-feature conditions; establish exact requirements before citing a violation.'],
    ['arena-changes','Identify temporary floor seating, concessions or event-use changes.','Refer changed layouts, cooking, displays and temporary equipment for the appropriate approval and inspection modules.'],
    ['crowd-response','Review crowd-management, announcement and assisted-evacuation arrangements.','Confirm responsible staff, emergency communication and the response to unavailable safety systems.'],
  ],
  'A-5':[
    ['outdoor-plan','Confirm the outdoor venue, seating and exit-gate arrangement.','Use approved event and venue records to establish the inspection boundary and applicable capacity information.'],
    ['gates','Review exit gates and paths through fences and exterior circulation areas.','Identify the available routes to safe areas and any parking or equipment affecting responder access.'],
    ['enclosed-spaces','Review spaces below stands and any enclosed support rooms.','Record combustible storage, concessions and utility uses; evaluate enclosed portions under their actual approved uses.'],
    ['temporary-event','Review temporary tents, cooking, fuel and electrical arrangements.','Identify applicable permits, responsible operators and specialist review for the equipment actually present.'],
    ['outdoor-response','Review staff plans for crowd movement, emergencies and reduced visibility.','Confirm how occupants are directed and alerted, including accessible evacuation and changes affecting route lighting or availability.'],
  ],
  'B':[
    ['service-use','Confirm each suite’s actual office, professional or service activity.','Record use changes and associated activities; building size or business name alone does not establish classification.'],
    ['suite-egress','Review reception, security and shared-corridor exit arrangements.','Inspect door operation and tenant routes under the approved arrangement, including access-controlled doors where present.'],
    ['workrooms','Review workroom storage, charging and equipment areas.','Record accessible conditions involving supplies, records, batteries and equipment; add specialized review where actual hazards warrant it.'],
    ['special-service','Identify laboratories, treatment services or other specialized business uses.','Determine whether ambulatory-care, laboratory or other specific provisions and qualified agency reviews apply.'],
    ['tenant-response','Confirm staff response and shared-building maintenance responsibilities.','Identify the parties responsible for emergency procedures, common routes, protection records and unresolved deficiencies.'],
  ],
  'E':[
    ['school-scope','Confirm the school or daycare use, inspection program and approved layout.','For mandated Illinois public-school work, use the required authorized program and forms. Establish the scope of any other educational or daycare visit.'],
    ['classroom-security','Review classroom and perimeter security against approved evacuation arrangements.','Record release methods and door-operation concerns without substituting a generic locking rule for the applicable approved requirements.'],
    ['classroom-materials','Review classroom displays, furnishings and storage conditions.','Document actual materials and their arrangement; verify the relevant provision before requiring removal.'],
    ['student-response','Review drills, staff duties and arrangements for students needing assistance.','Confirm applicable records and the actual emergency communication and evacuation plan.'],
    ['school-special-hazards','Review laboratories, shops, kitchens and other specialized teaching spaces.','Record the areas reached, accessible hazards and the technical or licensing reviewer needed for remaining scope.'],
  ],
  'F-1':[
    ['process','Compare current manufacturing processes and materials with approved operations.','Record changes in production, finishing, repair or packaging and their responsible design or permit review.'],
    ['byproducts','Review combustible waste, dust and process housekeeping.','Document visible accumulations and available hazard assessments; obtain qualified evaluation rather than applying an assumed dust threshold.'],
    ['process-permits','Identify hot work, finishing, flammable liquids and gas operations.','Record the current inventory and applicable permits or specialized controls for the actual process.'],
    ['process-protection','Review available process ventilation and protective-system records.','Identify accessible equipment, outstanding contractor findings and reported impairments. Operational testing remains a qualified task.'],
    ['shutdown-response','Review emergency shutdown access and worker-response arrangements.','Confirm responsible staff, accessible emergency information and procedures for changed or unavailable equipment.'],
  ],
  'F-2':[
    ['low-hazard-basis','Confirm that current materials and processes match the approved low-hazard use.','Record new coatings, packaging, fuels or process changes requiring classification or design review.'],
    ['added-combustibles','Review combustible packaging, pallets and waste in processing areas.','Document actual storage and housekeeping conditions and their relationship to hot equipment or protective features.'],
    ['heat-process','Review heating, kiln, furnace or similar process safeguards within scope.','Use approved equipment and maintenance information; refer technical safeguard or interlock testing to the qualified party.'],
    ['changed-materials','Identify added finishing, fuel-gas or hazardous-material activities.','Record the added processes and inventories for applicable permit and classification review.'],
    ['industrial-response','Review worker evacuation and emergency-shutdown procedures.','Confirm equipment access, responsible operators and communication when a protective system is unavailable.'],
  ],
  'H-1':[
    ['detonation-inventory','Confirm the approved detonation-hazard inventory and operating configuration.','Compare current materials, quantities and activities with the approved hazard and permit records; request specialist review for discrepancies.'],
    ['detonation-storage','Review authorized storage areas, compatibility and access controls.','Observe only within the safe authorized scope. Do not handle or disturb hazardous materials to perform this checklist.'],
    ['ignition-controls','Review documented ignition, static and other initiation controls.','Record observed changes or missing evidence against the approved safety basis, with evaluation by the responsible specialist.'],
    ['explosion-features','Review access and visible condition of approved explosion-protection features.','Record obstruction or alteration concerns and available qualified inspection records; no destructive or operational testing is implied.'],
    ['hazard-response','Review emergency notification, isolation and responder information.','Confirm the current emergency plan, responsible contacts and response to an unsafe or changed operating condition.'],
  ],
  'H-2':[
    ['rapid-burning-basis','Compare current rapid-burning hazards with the approved process basis.','Record gases, liquids, dust or other relevant materials and any quantity or operating-condition changes for specialist review.'],
    ['ventilation-detection','Review ventilation, detection and process-interlock documentation.','Identify the equipment and current qualified test or maintenance evidence; record reported unavailability distinctly from a compliance conclusion.'],
    ['transfer-controls','Review accessible transfer, container and spill-control arrangements.','Compare visible conditions with approved operations, including bonding or grounding where applicable and verified.'],
    ['explosion-housekeeping','Review housekeeping and access around approved explosion-control features.','Record altered processes or obstructions requiring technical evaluation rather than estimating performance.'],
    ['rapid-burning-response','Review permits, emergency shutdown and worker-response procedures.','Confirm responsibilities and notification for a release, alarm or unavailable safeguard.'],
  ],
  'H-3':[
    ['physical-inventory','Confirm the current physical-hazard inventory and permit basis.','Compare material classifications, quantities and operations with approved records and seek qualified review of changes.'],
    ['compatibility','Review storage locations, compatible segregation and approved containers.','Document accessible conditions and verify the governing material-specific requirements before citing them.'],
    ['oxidizer-separation','Review ignition and combustible-exposure controls for the materials present.','Address actual oxidizing, reactive or other physical hazards using the approved safety and design information.'],
    ['leak-spill','Review leakage, spill control and access to protective equipment.','Record visible conditions and current maintenance evidence; do not perform hazardous technical testing.'],
    ['physical-response','Review material-change, incident and emergency-contact procedures.','Confirm how the operator maintains the inventory, reports changes and responds to a protective-system impairment.'],
  ],
  'H-4':[
    ['health-inventory','Confirm toxic, corrosive or other health-hazard inventories and approved controls.','Record actual material classifications and quantities for qualified control-area and permit review.'],
    ['health-storage','Review containment, compatibility and identification of hazardous-material storage.','Compare accessible conditions with approved arrangements and material safety information.'],
    ['health-detection','Review ventilation, gas detection and alarm maintenance evidence.','Identify the qualified service records and unresolved findings for systems actually required or provided.'],
    ['delivery-spill','Review delivery routes, container handling and spill-response access.','Document accessible concerns and assigned responsibilities without entering an unsafe area.'],
    ['health-response','Review emergency isolation, notification and responder hazard information.','Confirm current emergency contacts, safety information and staff actions for a release or unavailable safeguard.'],
  ],
  'H-5':[
    ['hpm-process','Confirm the approved semiconductor process and hazardous-production-material inventory.','Compare current use and quantities with the approved HPM design, permit and classification records.'],
    ['hpm-routes','Review HPM delivery, storage and service-route arrangements.','Record accessible changes affecting designated rooms, corridors or separation features for qualified review.'],
    ['hpm-safeguards','Review exhaust, treatment, detection and interlock maintenance evidence.','Identify available qualified reports and unresolved deficiencies for the provided protection systems.'],
    ['hpm-shutdown','Review access to emergency shutdown and reported process changes.','Use the approved operating and safety arrangements; operational verification belongs to the qualified party.'],
    ['hpm-response','Review trained staff, contractor coordination and HPM emergency procedures.','Confirm responsibility for alarms, releases, maintenance work and protection-system impairment response.'],
  ],
  'I-1':[
    ['care-basis','Confirm the licensed residential-care use and occupants’ evacuation capabilities.','Verify the adopted-edition classification and conditions using approved records. An assisted-living name alone does not establish I-1.'],
    ['care-staffing','Review staff-assisted emergency arrangements for occupied hours.','Confirm the applicable emergency plan, assistance needs, training and drill documentation.'],
    ['care-routes','Review care-area corridors, doors and approved relocation arrangements.','Identify accessible fire and smoke protective features and record obstructions or changes requiring review.'],
    ['care-locking','Review approved security and door-release arrangements for residents.','Confirm the actual care and security needs against the applicable approved locking provisions.'],
    ['care-ancillary','Review care-related oxygen, cooking, laundry and emergency-power concerns.','Select the systems present and assign specialized or licensing review where the local visit does not cover those requirements.'],
  ],
  'I-2':[
    ['medical-basis','Confirm the licensed services, patient needs and approved life-safety plan.','Establish the responsible agency, inspection purpose and applicable medical-care classification before proceeding.'],
    ['medical-compartments','Review care corridors, compartment doors and relocation routes.','Include equipment or furniture affecting the approved relocation strategy and record inaccessible areas.'],
    ['medical-security','Review approved clinical-security and staff door-release arrangements.','Confirm the applicable containment needs, staff release methods and maintenance evidence.'],
    ['medical-gases','Review medical-gas and oxygen arrangements within the authorized scope.','Record accessible storage, use and protection concerns for the appropriate technical reviewer.'],
    ['medical-continuity','Review emergency power and life-safety impairment planning.','Identify qualified test records, outstanding findings and procedures to maintain care during an emergency or system outage.'],
  ],
  'I-3':[
    ['detention-basis','Confirm the approved detention condition and authorized inspection scope.','Identify the responsible agency, controlled areas and applicable security and life-safety arrangements.'],
    ['detention-release','Review staff release, keys and control-system maintenance evidence.','Use the approved emergency-release design and qualified records; do not operate detention controls without authorized coordination.'],
    ['detention-relocation','Review designated relocation spaces and routes between controlled areas.','Record accessible obstructions or changed compartment arrangements against the approved emergency strategy.'],
    ['detention-contents','Review contents and visible protection features in authorized occupied areas.','Record bedding, storage or tampering concerns using the governing approved requirements and the agreed safe access scope.'],
    ['detention-response','Review staff drills, accountability and emergency-response coordination.','Confirm who authorizes release and relocation, maintains control and communicates with responders.'],
  ],
  'I-4':[
    ['day-care-basis','Confirm care recipients, assistance needs and the approved daycare classification.','Verify license, ages, hours, floor of care and applicable exceptions through the authorized agency and adopted edition.'],
    ['day-care-evacuation','Review staff-assisted evacuation and transport arrangements.','Confirm the plan for all care recipients, including those who cannot independently use the available routes.'],
    ['day-care-rooms','Review care, sleeping and napping areas within the agreed scope.','Identify accessible detection, exits and reported maintenance concerns without treating unentered rooms as inspected.'],
    ['day-care-security','Review approved daycare security and exit-release arrangements.','Verify the actual locking and release provisions and the availability of the required routes.'],
    ['day-care-response','Review drills, staff duties, emergency contacts and reunification arrangements.','Use the appropriate Illinois daycare licensing and inspection program; this local checklist does not grant licensing clearance.'],
  ],
  'M':[
    ['sales-use','Confirm the current merchandise and approved sales-floor arrangement.','Identify accessory operations, changed tenant areas and uses that need additional classification or permit review.'],
    ['sales-aisles','Review displays, carts, checkout queues and security devices along exit routes.','Inspect the arrangement in use, including temporary promotional or seasonal displays.'],
    ['stock-arrangement','Review stockroom and rack-storage changes against approved protection information.','Record commodities, packaging and configuration changes that need sprinkler-design or high-piled storage review.'],
    ['special-merchandise','Identify aerosols, batteries, liquids or gases needing specialized review.','Record the actual inventory and display or storage arrangement; verify quantity and material-specific requirements separately.'],
    ['retail-responsibility','Review tenant, shared-area and seasonal-operation responsibilities.','Confirm who maintains exit availability, protection-system records and correction of outstanding findings.'],
  ],
  'R-1':[
    ['lodging-scope','Confirm the lodging use and the guest-room and common-area inspection scope.','Record agreed access and any units not entered; transient lodging classification must be established from approved use.'],
    ['lodging-doors','Review guest-room, corridor and stair-door operation within scope.','Record visible separation and closing or latching concerns against applicable approved requirements.'],
    ['lodging-detection','Review smoke, carbon-monoxide and occupant-notification coverage within scope.','Use the governing requirements and qualified service evidence; do not assume inaccessible rooms passed.'],
    ['lodging-support','Review laundry, kitchens, utilities and housekeeping storage.','Identify actual cooking, charging and other special hazards and select applicable system sections.'],
    ['lodging-response','Review guest notification, staff response and system-impairment procedures.','Confirm responsibilities for occupied hours, assistance needs and reporting or correcting safety-system problems.'],
  ],
  'R-2':[
    ['residential-access','Confirm dwelling or sleeping-unit coverage and authorized access.','Record units and common areas reached, those not inspected and the next access or follow-up action.'],
    ['residential-routes','Review common corridors, stairs and separation-door operation.','Include accessible door closing, latching and route obstructions under the applicable approved arrangement.'],
    ['residential-detection','Review smoke and carbon-monoxide devices within the authorized scope.','Record coverage and available inspection evidence, retaining the distinction between inspected and inaccessible areas.'],
    ['residential-support','Review laundry, utilities, parking, waste and charging conditions.','Record the actual locations and hazards and determine whether additional system or specialized inspection is needed.'],
    ['resident-management','Review management and resident emergency information and correction procedures.','Confirm responsibility for system records, impairment communication and obtaining access for unresolved inspection scope.'],
  ],
  'R-3':[
    ['dwelling-basis','Confirm the approved residential arrangement and IBC or IRC inspection scope.','Identify dwelling, boarding, home-care or other actual uses without inferring the legal group from size or appearance.'],
    ['dwelling-escape','Review accessible sleeping-area exit and emergency-escape arrangements.','Inspect only within lawful authorized access and verify the applicable code provisions before recording a violation.'],
    ['dwelling-detection','Review smoke and carbon-monoxide devices within the inspection scope.','Record visible condition, reported maintenance and any inaccessible rooms without assuming full building coverage.'],
    ['dwelling-support','Review accessible garage, heating, laundry and fuel-use conditions.','Identify actual ignition, storage or ventilation concerns for applicable local or specialist review.'],
    ['dwelling-change','Identify care, boarding or home-business changes needing classification review.','Record the use, assistance needs and approval documents; establish applicable emergency information and responsible contacts.'],
  ],
  'R-4':[
    ['small-care-basis','Confirm the residential-care license, residents and approved classification.','Verify the adopted edition and care or evacuation conditions. Smaller size does not independently establish R-4.'],
    ['small-care-assistance','Review staff assistance and emergency procedures for all occupied hours.','Confirm the plan matches current resident needs and applicable training and drill records.'],
    ['small-care-routes','Review sleeping-room routes, stairs and protective-door features.','Record accessible conditions against the approved residential-care arrangement and identify areas not inspected.'],
    ['small-care-security','Review approved resident-security and door-release arrangements.','Document locking and release concerns using the governing approved requirements rather than a generic care-facility rule.'],
    ['small-care-support','Review cooking, laundry, oxygen and provided protection-system records.','Select relevant system sections and identify the state licensing or technical review needed for remaining issues.'],
  ],
  'S-1':[
    ['storage-plan','Compare current commodities, racks and storage configuration with approved records.','Record changes in arrangement and storage height for appropriate permit and design review.'],
    ['storage-combustibles','Review packaging, pallets and waste affecting storage hazards.','Document the actual commodities and packaging, including changes relevant to high-piled storage or protection design.'],
    ['storage-design','Review whether storage remains consistent with the sprinkler design basis.','Use available approved design information and qualified reports; verify clearance and other numerical requirements separately.'],
    ['storage-special','Identify batteries, liquids, cylinders or other special storage materials.','Record the inventory and locations for material-specific classification, permit and protection review.'],
    ['storage-operations','Review loading, charging, hot work and responder-access arrangements.','Identify current operations, responsible staff and emergency or impairment procedures applicable to those activities.'],
  ],
  'S-2':[
    ['low-storage-basis','Confirm that actual goods and use match the approved low-hazard classification.','Review the commodity and packaging basis and any changed activity requiring classification review.'],
    ['low-storage-packaging','Review added packaging, pallets and other combustibles.','Record changes in stock, storage arrangement and combustible exposure that may affect approved protection assumptions.'],
    ['parking-use','Identify any parking, charging, repair or other associated activity.','Verify which use is approved and whether fuel, battery or repair operations need a separate technical or occupancy review.'],
    ['parking-protection','Review available protection and ventilation records for the actual use.','Identify provided systems, reported impairments and qualified inspection evidence; equipment presence alone does not prove compliance.'],
    ['low-storage-access','Review responder routes, exit paths and service-area storage.','Record access conditions and responsibilities for maintenance, system records and unresolved findings.'],
  ],
  'U':[
    ['utility-use','Confirm the actual accessory, agricultural or miscellaneous use and approved scope.','Determine that the use qualifies for Group U using approved records rather than treating all small structures as utility occupancies.'],
    ['utility-storage','Review stored fuels, cylinders, batteries and electrical equipment.','Record the actual materials and installations for applicable material-specific or qualified review.'],
    ['utility-heating','Review heating, mechanical equipment and nearby combustible exposures.','Identify accessible venting, ignition or storage concerns against the applicable approved arrangement.'],
    ['utility-access','Review access, openings and provided protection features within scope.','Identify responder or occupant routes and any obstruction or reported safety-system problem.'],
    ['utility-change','Identify new occupied activities or use changes needing classification review.','Record assembly, business, care, residential or process activities requiring a decision by the responsible official.'],
  ],
};

/** Fresh snapshots only: existing inspections retain their own questions and answers. */
export function buildGroupChecklist(groups:readonly string[],systems:readonly string[]=[]):GroupChecklistItem[] {
  const codes=normalizeGroupCodes(groups);
  const base=buildResearchedChecklist('Mixed use',systems).filter(item=>item.researchOrigin!=='occupancy').map(item=>({...item,id:'group-'+item.id.replace(/^mixed-use-/, '')}));
  const classificationSource:ResearchSource={id:'icc-classification-guidance',title:'ICC occupancy classification guidance — group context, not an inspection approval',url:OCCUPANCY_CLASSIFICATION_SOURCES[0].url,type:'official checklist'};
  const specific:GroupChecklistItem[]=codes.flatMap(code=>{
    const group=getOccupancyGroup(code)!;
    const familySources=buildResearchedChecklist(group.families[0]).filter(item=>item.researchOrigin==='occupancy').flatMap(item=>item.researchSources).filter(source=>source.type!=='forum lead');
    const sourceMap=new Map([classificationSource,...familySources].map(source=>[source.id,source]));
    // Keep per-question provenance concise so mixed-use snapshots fit the record limit.
    const sources=[...sourceMap.values()].slice(0,3);
    return prompts[code].map(([id,title,guidance])=>({
      id:'group-'+code.toLowerCase()+'-'+id,
      title:codes.length>1?code+' · '+title:title,
      category:code+' · '+group.familyLabel,
      guidance,
      sourceIds:sources.map(source=>source.id),
      researchSources:sources.map(source=>({...source})),
      reference:'Inspection prompt — exact adopted citation and applicability require review',
      sourceUrl:group.sourceUrls[0],
      verified:false as const,
      researchCheckedOn:'2026-11-13',
      researchOrigin:'occupancy' as const,
      occupancyGroup:code,
    }));
  });
  // Base contains one shared core and one copy of each selected system section.
  return [...base.filter(item=>item.researchOrigin==='shared'),...specific,...base.filter(item=>item.researchOrigin==='system')];
}
