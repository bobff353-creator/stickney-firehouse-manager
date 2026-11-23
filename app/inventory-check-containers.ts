import type {InventoryRow} from './inventory-index';
const text=(row:InventoryRow|undefined,key:string)=>String(row?.[key]??'');
const kinds=new Set(['bag','kit','toolbox','container']);
export type ChecklistNode={key:string;label:string;row?:InventoryRow;container:boolean;children:ChecklistNode[]};

/** Presentation only: retain every saved row/ID, including orphaned and legacy rows. */
export function checklistContainers(rows:InventoryRow[],equipment:InventoryRow[]):ChecklistNode[]{
 const assets=new Map(equipment.map(row=>[text(row,'id'),row]));
 const containerKeys=new Set<string>();
 const nodes:ChecklistNode[]=rows.map(row=>{const assetId=text(row,'equipment_id'),container=kinds.has(text(assets.get(assetId),'item_type')),key=container&&!containerKeys.has(assetId)?'container:'+assetId:'row:'+text(row,'id');if(container)containerKeys.add(assetId);return {key,label:text(row,'equipment_name')||text(row,'name')||'Unnamed item',row,container,children:[]};});
 const byAsset=new Map<string,ChecklistNode>();for(const node of nodes)if(!byAsset.has(text(node.row,'equipment_id')))byAsset.set(text(node.row,'equipment_id'),node);
 const parent=new Map<ChecklistNode,ChecklistNode>();
 for(const node of [...nodes]){
  const asset=assets.get(text(node.row,'equipment_id')),parentId=text(asset,'parent_equipment_id'),container=assets.get(parentId);
  if(!asset||!container||parentId===text(asset,'id')||!kinds.has(text(container,'item_type'))||text(asset,'apparatus_id')!==text(container,'apparatus_id')||text(asset,'compartment_id')!==text(container,'compartment_id'))continue;
  let target=byAsset.get(parentId);
  if(target?.row&&text(target.row,'compartment_label')!==text(node.row,'compartment_label'))continue;
  if(!target){target={key:'container:'+parentId,label:text(container,'name')||'Container',container:true,children:[]};byAsset.set(parentId,target);nodes.push(target);}
  // Break corrupt legacy cycles instead of hiding a saved check item.
  let ancestor:ChecklistNode|undefined=target;const seen=new Set<ChecklistNode>([node]);let cycle=false;
  while(ancestor){if(seen.has(ancestor)){cycle=true;break;}seen.add(ancestor);ancestor=parent.get(ancestor);}
  if(!cycle){parent.set(node,target);target.container=true;}
 }
 for(const [child,target] of parent)target.children.push(child);
 return nodes.filter(node=>!parent.has(node));
}
export function containedProgress(node:ChecklistNode):{total:number;pending:number}{
 return node.children.reduce((count,child)=>{const nested=containedProgress(child);return {total:count.total+(child.row?1:0)+nested.total,pending:count.pending+(child.row?.result==='pending'?1:0)+nested.pending};},{total:0,pending:0});
}
