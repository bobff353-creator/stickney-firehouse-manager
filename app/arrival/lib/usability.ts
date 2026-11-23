import type {PlanRecord} from './preplan';
import type {Draft} from '../ui/editor';
import {preplanDetailDraft} from './edit-navigation.ts';

export function recordEditingDraft(record:PlanRecord,local:Draft|undefined,label='Location'):Draft{
  const base=local?.id===record.id?local:{id:record.id,revision:record.revision,data:record.working};
  return preplanDetailDraft({...base,data:structuredClone(base.data)},label);
}
export function draftProgressLabel(draft:Draft){
  if(draft.kind==='details')return 'Building measurements & details';
  if(draft.kind==='photos')return 'Photos & plans';
  if(draft.kind==='full')return `Full preplan · step ${draft.data.step+1} of 6`;
  return `Quick preplan · step ${draft.data.step>=5?3:draft.data.step>=2?2:1} of 3`;
}
export function preplanReturn(page:string){
  return page==='review'?{page:'review',label:'Back to review queue'}:page==='overview'?{page:'overview',label:'Back to overview'}:{page:'preplans',label:'Back to preplans'};
}
