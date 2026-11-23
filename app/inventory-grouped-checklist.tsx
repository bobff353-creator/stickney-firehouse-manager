'use client';
import {useMemo,useState,type ReactNode} from 'react';
import {checklistContainers,containedProgress,type ChecklistNode} from './inventory-check-containers';
import type {InventoryRow} from './inventory-index';
export default function InventoryGroupedChecklist({items,equipment,preview=false,renderItem}:{items:InventoryRow[];equipment:InventoryRow[];preview?:boolean;renderItem:(row:InventoryRow)=>ReactNode}){
 // Keep active editors in place if another administrator moves inventory mid-check.
 const [openedEquipment]=useState(()=>equipment.map(({id,name,item_type,parent_equipment_id,apparatus_id,compartment_id})=>({id,name,item_type,parent_equipment_id,apparatus_id,compartment_id}) as InventoryRow));
 const links=preview?equipment:openedEquipment;
 const nodes=useMemo(()=>checklistContainers(items,links),[items,links]);
 function render(node:ChecklistNode):ReactNode{
  if(!node.container)return node.row?<div key={node.key}>{renderItem(node.row)}</div>:null;
  const progress=containedProgress(node);
  return <details className="check-container-group" key={node.key}><summary><strong>{node.label}</strong><span>{progress.total} {progress.total===1?'item':'items'} shown inside{!preview&&progress.total?` · ${progress.pending} remaining`:''}</span><span className="check-container-open">Show / hide contents</span></summary><div className="check-container-body"><p>{preview?'Read-only preview. Result controls stay disabled.':'Grouped by inventory links when opened. Record each listed item separately; saving the container does not check its contents.'}</p>{node.row?renderItem(node.row):<p>Container shown for grouping; only the listed items have check controls here.</p>}{node.children.length?node.children.map(render):<p>No contained items are listed on this checklist. Inventory setup controls which items appear on future checks.</p>}</div></details>;
 }
 return <>{nodes.map(render)}</>;
}
