// Photo coordinates only. These marks never create geographic/operational records.
export const photoSymbols = [
  ['side-a','A','Alpha / A side','Sides'],['side-b','B','Bravo / B side','Sides'],
  ['side-c','C','Charlie / C side','Sides'],['side-d','D','Delta / D side','Sides'],
  ['entry','IN','Entry / access','Access'],['exit','OUT','Exit','Access'],
  ['knox','K','Knox Box','Access'],['stairs','ST','Stairs','Access'],
  ['roof','RF','Roof access','Access'],['elevator','EL','Elevator','Access'],
  ['fdc','FDC','Fire department connection','Fire protection'],['hydrant','HYD','Hydrant','Fire protection'],
  ['riser','R','Riser','Fire protection'],['sprinkler','SP','Sprinkler control','Fire protection'],
  ['standpipe','STP','Standpipe','Fire protection'],['alarm','AP','Alarm panel','Fire protection'],
  ['extinguisher','EXT','Fire extinguisher','Fire protection'],['fire-wall','FW','Fire wall','Fire protection'],
  ['gas','G','Gas shutoff','Utilities'],['water','W','Water shutoff','Utilities'],
  ['electric','E','Electrical shutoff','Utilities'],['solar','PV','Solar / photovoltaic','Utilities'],
  ['hazard','!','Hazard / caution','Hazards'],['collapse','CZ','Collapse concern','Hazards'],
  ['hazmat','HM','Hazardous materials','Hazards'],['propane','LP','Propane tank','Hazards'],
  ['oxygen','O2','Oxygen','Hazards'],['truss','TR','Truss construction','Hazards'],
  ['arrow','→','Direction arrow','Drawing'],['circle','○','Highlight circle','Drawing'],
  ['label','TXT','Custom text label','Drawing'],
] as const;
export type PhotoSymbol = typeof photoSymbols[number][0];
export type PhotoIllustration = {id:string;symbol:PhotoSymbol;x:number;y:number;size:number;rotation:number;label:string};
export type IllustratedPhoto = {id:string;side:string;featureId?:string;filename?:string;caption:string;url:string;illustrations?:PhotoIllustration[];illustrationVersion?:number};
const symbols = new Set<string>(photoSymbols.map(([key])=>key));
export function validateIllustrations(value:unknown):PhotoIllustration[] {
  if(!Array.isArray(value)||value.length>80)throw new Error('Use up to 80 photo symbols.');
  const ids=new Set<string>();
  return value.map(item=>{
    if(!item||typeof item!=='object')throw new Error('Invalid photo symbol.');
    const {id,symbol,x,y,size,rotation,label}=item as Record<string,unknown>;
    if(typeof id!=='string'||!/^[\w-]{1,80}$/.test(id)||ids.has(id)||typeof symbol!=='string'||!symbols.has(symbol))throw new Error('Invalid or duplicate photo symbol.');
    for(const [key,n,min,max] of [['x',x,0,100],['y',y,0,100],['size',size,4,20],['rotation',rotation,0,360]] as const){
      if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)throw new Error(`Invalid photo symbol ${key}.`);
    }
    if(typeof label!=='string'||label.length>32)throw new Error('Photo symbol labels must be 32 characters or fewer.');
    ids.add(id);
    return {id,symbol:symbol as PhotoSymbol,x:x as number,y:y as number,size:size as number,rotation:rotation as number,label};
  });
}
export function readIllustrations(value:unknown):PhotoIllustration[]{
  try{return validateIllustrations(typeof value==='string'?JSON.parse(value):value??[]);}catch{return [];}
}
