"use client";
import { useEffect, useRef, useState } from 'react';
import { useUnsavedWork } from './use-unsaved-work';
import { containerEquipmentPage, containerText as text, type ContainerRow as Row } from './inventory-container-picker';

type Props = { container: Row; equipment: Row[]; busy: boolean; onAction: (name: string, payload: Record<string, unknown>) => Promise<boolean>; message: string; onRefresh: () => Promise<boolean>; focusOnOpen?: boolean; onDraftChange?: (dirty: boolean) => void };
export default function InventoryContainerContents({ container, equipment, busy, onAction, message, onRefresh, focusOnOpen, onDraftChange }: Props) {
  const heading = useRef<HTMLHeadingElement>(null), searchInput = useRef<HTMLInputElement>(null), newInput = useRef<HTMLInputElement>(null);
  const [mode,setMode] = useState<'existing'|'new'>('existing');
  const [query,setQuery] = useState(''), [scope,setScope] = useState<'compartment'|'rig'>('compartment'), [grouping,setGrouping] = useState<'all'|'loose'|'grouped'>('all'), [page,setPage] = useState(1);
  const [contentsQuery,setContentsQuery] = useState(''), [contentsPage,setContentsPage] = useState(1);
  const [confirmation,setConfirmation] = useState<{item:Row; operation:'add'|'remove'|'delete'}|null>(null);
  const [newName,setNewName] = useState(''), [newQuantity,setNewQuantity] = useState('1'), [editing,setEditing] = useState(''), [name,setName] = useState(''), [quantity,setQuantity] = useState('1'), [error,setError] = useState(''), [receipt,setReceipt] = useState('');
  const createAttempt = useRef<string|null>(null);
  const [createLocked,setCreateLocked] = useState(false);
  const children = equipment.filter(item => item.parent_equipment_id === container.id && !item.retired_at);
  const editingItem = children.find(item => item.id === editing);
  const editDirty = Boolean(editingItem && (name !== text(editingItem,'name') || quantity !== (text(editingItem,'quantity_required') || '1')));
  useUnsavedWork(Boolean(newName || editDirty), busy);
  useEffect(()=>{onDraftChange?.(Boolean(newName || editDirty));},[newName,editDirty,onDraftChange]);
  useEffect(() => { if(focusOnOpen) { heading.current?.focus({preventScroll:true}); heading.current?.scrollIntoView({block:'start'}); } }, [focusOnOpen]);
  const picker = containerEquipmentPage(equipment,container,{query,scope,grouping,page});
  const matches = children.filter(item => `${text(item,'name')} ${text(item,'barcode')} ${text(item,'serial_number')}`.toLowerCase().includes(contentsQuery.trim().toLowerCase())).sort((a,b) => text(a,'name').localeCompare(text(b,'name')) || text(a,'id').localeCompare(text(b,'id')));
  const childPages = Math.max(1,Math.ceil(matches.length/10)), childPage = Math.min(contentsPage,childPages);
  const parentName = (item:Row) => text(equipment.find(parent => parent.id === item.parent_equipment_id) || {},'name') || 'another container';
  async function manage(item:Row, operation:'add'|'remove'|'edit') {
    setError(''); setReceipt('');
    if(operation==='edit' && (!name.trim() || !Number.isInteger(Number(quantity)) || Number(quantity)<1)) { setError('Enter an item name and a whole quantity of at least 1.'); return; }
    const saved = await onAction('container-item',{action:'manage_container_item',containerId:container.id,equipmentId:item.id,operation,expectedUpdatedAt:item.updated_at??null,...(operation==='edit'?{name,quantityRequired:Number(quantity)}:{})});
    if(saved) { setEditing(''); setConfirmation(null); setReceipt(`Change saved for ${text(item,'name')}. Review the refreshed contents below.`); if(operation==='add')searchInput.current?.focus(); }
    else setError('The change was not confirmed. Your selections are kept. Refresh contents to review the saved record before retrying.');
  }
  function createNew() { setMode('new'); setNewName(current=>current || query.trim()); window.requestAnimationFrame(()=>newInput.current?.focus()); }
  async function create() {
    setError(''); setReceipt('');
    if(!newName.trim() || !Number.isInteger(Number(newQuantity)) || Number(newQuantity)<1) { setError('Enter a name and whole quantity of at least 1.'); return; }
    createAttempt.current ??= crypto.randomUUID(); setCreateLocked(true);
    const saved = await onAction('create-container-item',{action:'create_equipment',createAttemptId:createAttempt.current,name:newName,quantityRequired:Number(newQuantity),compartmentId:container.compartment_id,parentEquipmentId:container.id,itemType:'individual',equipmentCategory:'equipment',checkTypes:container.check_types||['inventory']});
    if(saved) { setReceipt(`Create saved for ${newName}. Review the refreshed contents below.`); setNewName(''); setNewQuantity('1'); createAttempt.current=null; setCreateLocked(false); }
    else setError('Create was not confirmed. Retry the same details to confirm the original request without creating a duplicate. Refresh contents to review what is saved.');
  }
  async function cancelNew() {
    if(createAttempt.current) {
      if(!window.confirm('This request may already have saved. Refresh and review contents before starting another item. Discard only this local draft?'))return;
      if(!await onRefresh()) { setError('Refresh did not finish. Keep this draft and retry the refresh.'); return; }
    }
    setNewName(''); setNewQuantity('1'); createAttempt.current=null; setCreateLocked(false); setMode('existing');
  }
  return <section className="inventory-container-contents" aria-label="Items inside this container" onKeyDown={event=>{if(event.key==='Enter' && (event.target as HTMLElement).tagName==='INPUT')event.preventDefault();}}>
    <h4 ref={heading} tabIndex={-1}>Contents of {text(container,'name')}</h4>
    <p><strong>{text(container,'compartment_label')||'Saved compartment'}</strong> · {children.length} saved items inside. Contents save separately from the container details above. Existing check reports keep their original results.</p>
    <div className="container-mode-actions">
      <button type="button" aria-pressed={mode==='existing'} disabled={busy||editDirty} onClick={()=>{setMode('existing');window.requestAnimationFrame(()=>searchInput.current?.focus());}}>Find existing equipment</button>
      <button type="button" aria-pressed={mode==='new'} disabled={busy||editDirty} onClick={createNew}>Create new equipment</button>
      <button type="button" disabled={busy} onClick={()=>void onRefresh()}>Refresh contents</button>
    </div>
    {newName && mode==='existing' && <p role="status">Your new-item draft is kept under Create new equipment.</p>}
    {message && <p role="status">{message}</p>}{receipt && <p role="status">{receipt}</p>}{error && <p role="alert">{error}</p>}
    {confirmation && <div className="container-item-confirmation" role="alertdialog" aria-labelledby="container-confirm-title">
      <h4 id="container-confirm-title">{confirmation.operation==='delete'?'Delete':confirmation.operation==='remove'?'Remove':'Move'} {text(confirmation.item,'name')}?</h4>
      <p>{confirmation.operation==='delete'?'This removes the item from active inventory. Saved inspection and service history stays intact.':confirmation.operation==='remove'?'This keeps the item in the same compartment, outside this container.':`Move the existing item from ${parentName(confirmation.item)} to ${text(container,'name')}? Its ID, quantity, service details and saved history stay intact.`}</p>
      <button type="button" disabled={busy} onClick={async()=>{if(confirmation.operation==='delete'){if(await onAction('delete-container-item',{action:'delete_equipment',equipmentId:confirmation.item.id,confirmed:true}))setConfirmation(null);}else await manage(confirmation.item,confirmation.operation);}}>Confirm {confirmation.operation==='add'?'move':confirmation.operation}</button>
      <button type="button" autoFocus disabled={busy} onClick={()=>setConfirmation(null)}>Cancel</button>
    </div>}
    {mode==='existing' ? <div className="container-equipment-finder">
      <h4>Add existing equipment</h4><p>Search by name, barcode, serial number, model or bag name. Add keeps the existing record; it does not make a copy.</p>
      <div className="container-finder-filters">
        <label>Find equipment<input ref={searchInput} type="search" value={query} placeholder="Name, barcode, model or bag" onChange={event=>{setQuery(event.target.value);setPage(1);}}/></label>
        <label>Look in<select value={scope} onChange={event=>{setScope(event.target.value as typeof scope);setPage(1);}}><option value="compartment">This compartment</option><option value="rig">All locations on this rig</option></select></label>
        <label>Current grouping<select value={grouping} onChange={event=>{setGrouping(event.target.value as typeof grouping);setPage(1);}}><option value="all">All eligible equipment</option><option value="loose">Not inside another container</option><option value="grouped">Inside another bag, kit or box</option></select></label>
      </div>
      <p role="status">{picker.total} matching items · Page {picker.page} of {picker.pages}</p>
      <ul className="container-candidate-list">{picker.rows.map(item=><li key={text(item,'id')}>
        <div><strong>{text(item,'name')} · Qty {text(item,'quantity_required')||'1'}</strong><p>{text(item,'compartment_label')||'Location not assigned'} · {item.parent_equipment_id?`Inside ${parentName(item)}`:'Not in a container'}</p>{(item.barcode||item.serial_number)&&<small>{item.barcode?`Barcode: ${text(item,'barcode')}`:`Serial: ${text(item,'serial_number')}`}</small>}</div>
        {item.compartment_id===container.compartment_id?<button type="button" disabled={busy||editDirty} aria-label={`Add ${text(item,'name')} to ${text(container,'name')}`} onClick={()=>{if(item.parent_equipment_id)setConfirmation({item,operation:'add'});else void manage(item,'add');}}>{item.parent_equipment_id?'Review move here':'Add to this container'}</button>:<p>In another compartment. Change its saved location in Inventory before adding it here.</p>}
      </li>)}</ul>
      {!picker.total&&<p>No eligible equipment matches. Try All locations on this rig or clear the search. Items already inside are listed below. Registered air equipment and bags/kits are managed separately.</p>}
      {picker.pages>1&&<nav className="container-pages" aria-label="Equipment search pages"><button type="button" disabled={busy||picker.page===1} onClick={()=>setPage(picker.page-1)}>Previous equipment</button><span>{picker.page} / {picker.pages}</span><button type="button" disabled={busy||picker.page===picker.pages} onClick={()=>setPage(picker.page+1)}>Next equipment</button></nav>}
      <button type="button" disabled={busy||editDirty} onClick={createNew}>Not already in inventory? Create a new item</button>
    </div>:<div className="container-new-equipment">
      <h4>Create new equipment in {text(container,'name')}</h4><p>Use this only for equipment that does not already have an inventory record. It will use this container’s saved location and checklist types.</p>
      <div className="container-add-tools"><label>New item name<input ref={newInput} value={newName} disabled={busy||createLocked} onChange={event=>setNewName(event.target.value)}/></label><label>New item quantity<input type="number" min="1" step="1" value={newQuantity} disabled={busy||createLocked} onChange={event=>setNewQuantity(event.target.value)}/></label><button type="button" disabled={busy||!newName.trim()} onClick={()=>void create()}>Create item in container</button><button type="button" disabled={busy} onClick={()=>void cancelNew()}>Cancel new item</button></div>
    </div>}
    <h4>Saved items inside ({children.length})</h4>
    <label>Find an item inside<input type="search" value={contentsQuery} disabled={busy||editDirty} onChange={event=>{setContentsQuery(event.target.value);setContentsPage(1);}} placeholder="Name, barcode or serial number"/></label>
    {matches.length?<ul className="container-item-list">{matches.slice((childPage-1)*10,childPage*10).map(item=><li key={text(item,'id')}>
      {editing===item.id?<div className="container-item-edit"><label>Item name<input aria-label={'Item name for '+text(item,'name')} value={name} disabled={busy} onChange={event=>setName(event.target.value)}/></label><label>Required quantity<input aria-label={'Quantity for '+text(item,'name')} type="number" min="1" step="1" value={quantity} disabled={busy} onChange={event=>setQuantity(event.target.value)}/></label><button type="button" disabled={busy} onClick={()=>void manage(item,'edit')}>Save changes</button><button type="button" disabled={busy} onClick={()=>setEditing('')}>Cancel edit</button></div>:<>
        <strong>{text(item,'name')} · Qty {text(item,'quantity_required')||'1'}</strong><div className="container-item-actions">
          <button type="button" disabled={busy||editDirty||Boolean(confirmation)||Boolean(item.scba_asset_kind)} aria-label={'Edit '+text(item,'name')} onClick={()=>{if(editDirty&&!window.confirm('Discard the unsaved item edit?'))return;setEditing(text(item,'id'));setName(text(item,'name'));setQuantity(text(item,'quantity_required')||'1');}}>Edit item</button>
          <button type="button" disabled={busy||editDirty||Boolean(confirmation)||Boolean(item.scba_asset_kind)} aria-label={'Remove '+text(item,'name')+' from container'} onClick={()=>setConfirmation({item,operation:'remove'})}>Remove</button>
          <button type="button" disabled={busy||editDirty||Boolean(confirmation)||Boolean(item.scba_asset_kind)} aria-label={'Delete '+text(item,'name')} onClick={()=>setConfirmation({item,operation:'delete'})}>Delete item</button>
        </div></>}
    </li>)}</ul>:<p>{children.length?'No contents match this search.':'This container is empty. Find existing equipment or create a new item above.'}</p>}
    {childPages>1&&<nav className="container-pages" aria-label="Container contents pages"><button type="button" disabled={busy||editDirty||childPage===1} onClick={()=>setContentsPage(childPage-1)}>Previous contents</button><span>{childPage} / {childPages}</span><button type="button" disabled={busy||editDirty||childPage===childPages} onClick={()=>setContentsPage(childPage+1)}>Next contents</button></nav>}
    {editingItem&&<p role="status">Editing {text(editingItem,'name')}. Save changes or cancel the edit before leaving.</p>}
    {children.length>0&&<p>Remove keeps an item in this compartment, outside the container. Delete removes it from active inventory and keeps saved history. Empty the container before deleting the container itself.</p>}
  </section>;
}
