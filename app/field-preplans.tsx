"use client";
/* eslint-disable @next/next/no-img-element -- imagery tiles and protected field photos are runtime sources. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { availableHydrantFlow, hydrantOutletFlow, nfpa291FlowClass } from "./hydrant-flow";
import GoogleFieldMap from "./google-field-map";
import { createPreplanContact, createPreplanPhone, parsePreplanContacts, serializePreplanContacts, type PreplanContact } from "./preplan-contacts";
import { constructionOptions, detailedPreplanMapView, footprintCentroid, polygonAreaSquareFeet, suggestedFireFlow, type ConstructionGroup, type OccupancyFlowCategory, type SprinklerStandard } from "./preplan-fire-flow";
import OperationalPreplanPanel, { type OperationalMapDraft, type OperationalMapOverlay, type OperationalMapPoint } from "./preplans/operational-panel";

type Point = { lat:number; lng:number };
type Feature = { id:string; preplanId:string; featureType:string; label:string; latitude:number; longitude:number; systemType:string; serviceStatus:string; details:string };
type Photo = { id:string; side:string; featureId?:string; filename:string; caption:string; url:string };
type Flush = { id:string;flushedAt:string;flushedBy:string;waterClear:number;issues:string;notes:string };
type FlowTest = { id:string;flowHydrantId:string;flowHydrantNumber:string;testedAt:string;staticPressure:number;residualPressure:number;desiredResidual:number;outletDiameter:number;pitotPressure:number;dischargeCoefficient:number;measuredFlow:number;availableFlow:number;testedBy:string;notes:string };
type Hydrant = { id:string;hydrantNumber:string;address:string;latitude:number;longitude:number;serviceStatus:string;manufacturer:string;model:string;portCount:number;portSizes:string[];notes:string;flushes:Flush[];flowTests:FlowTest[] };
type Preplan = {
  id:string; businessName:string; address:string; latitude:number; longitude:number; aSideLatitude:number|null; aSideLongitude:number|null; footprint:Point[];
  contactInfo:string; construction:string; accessInfo:string; alarmSystem:string; knoxBox:string; riser:string; fdc:string; sprinklerSystem:string;
  footprintSquareFeet:number; floorCount:number; fireFlowCalculationArea:number; constructionType:ConstructionGroup; occupancyFlowCategory:OccupancyFlowCategory; sprinklerStandard:SprinklerStandard; suggestedFireFlowGpm:number; suggestedFireFlowDuration:number;
  status:string; updatedBy:string; updatedAt:string; features:Feature[]; photos:Photo[];
};
type ImportedBuilding = { id:string;businessName:string;address:string;sourceFile:string;sourceRow:number;status:string;latitude:number|null;longitude:number|null;geocodeNote:string;linkedPreplanId:string|null };
type Form = Omit<Preplan,"features"|"photos"|"updatedBy"|"updatedAt"> & { street:string; city:string; state:string; zipCode:string; contacts:PreplanContact[] };
type LocationState = "locating"|"current"|"fallback"|"record";

const stickney:Point = { lat:41.8189, lng:-87.7734 };
const defaultAddress = { street:"",city:"Stickney",state:"Illinois",zipCode:"60402" };
function addressParts(address:string){
  let remaining=address.trim();const zipCode=remaining.match(/\b\d{5}(?:-\d{4})?\s*$/)?.[0]??"60402";
  remaining=remaining.replace(/\b\d{5}(?:-\d{4})?\s*$/,"").replace(/[\s,]+$/,"");
  const stateMatch=remaining.match(/\b(?:Illinois|IL)\s*$/i);const state="Illinois";
  if(stateMatch)remaining=remaining.slice(0,stateMatch.index).replace(/[\s,]+$/,"");
  const comma=remaining.lastIndexOf(",");
  if(comma>=0)return {street:remaining.slice(0,comma).trim(),city:remaining.slice(comma+1).trim()||"Stickney",state,zipCode};
  const cityMatch=remaining.match(/\b(Stickney|Sticiney|Chicago|Berwyn|Cicero|Lyons|Forest View|McCook)\s*$/i);
  if(cityMatch)return {street:remaining.slice(0,cityMatch.index).replace(/[\s,]+$/,"").trim(),city:cityMatch[1].toLowerCase()==="sticiney"?"Stickney":cityMatch[1],state,zipCode};
  return {...defaultAddress,street:remaining};
}
function fullAddress(value:Pick<Form,"street"|"city"|"state"|"zipCode">){const street=value.street.trim(),city=value.city.trim(),state=value.state.trim(),zip=value.zipCode.trim();return [street,city,[state,zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");}
function simpleConstruction(value:ConstructionGroup):ConstructionGroup{return ({IA_IB:"I",IIA_IIIA:"II",IIB_IIIB:"III",IV_VA:"IV",VB:"V"} as Partial<Record<ConstructionGroup,ConstructionGroup>>)[value]??value;}
function formFromPlan(plan:Preplan):Form{return {...plan,...addressParts(plan.address),contacts:parsePreplanContacts(plan.contactInfo),constructionType:simpleConstruction(plan.constructionType)};}
const empty = (center:Point):Form => ({ id:"",businessName:"",address:"Stickney, Illinois 60402",...defaultAddress,latitude:center.lat,longitude:center.lng,aSideLatitude:null,aSideLongitude:null,footprint:[],contactInfo:"",contacts:[createPreplanContact()],construction:"",accessInfo:"",alarmSystem:"",knoxBox:"",riser:"",fdc:"",sprinklerSystem:"",footprintSquareFeet:0,floorCount:1,fireFlowCalculationArea:0,constructionType:"V",occupancyFlowCategory:"other",sprinklerStandard:"none",suggestedFireFlowGpm:0,suggestedFireFlowDuration:0,status:"Quick Preplan" });
const pinTypes = [
  ["knox","K","Knox Box"],["fdc","F","FDC"],["riser","R","Riser"],["sprinkler","S","Sprinkler"],["alarm","A","Alarm Panel"],
  ["gas","G","Gas Shutoff"],["water","W","Water Shutoff"],["electric","E","Electrical Panel"],["propane","P","Propane Tank"],
  ["elevator","EL","Elevator"],["elevator_room","ER","Elevator Room"],["standpipe","ST","Standpipe"],["access","→","Access"],["hazard","!","Hazard"],
] as const;
const pinMeta = Object.fromEntries(pinTypes.map(([key,short,label]) => [key,{short,label}])) as Record<string,{short:string;label:string}>;
const systemOptions = ["","Wet","Dry","Deluge","Pre-action","Combination","Local alarm","Monitored alarm","Keyed access","Other"];
const quickSystemFields = [
  { key:"alarmSystem", label:"Alarm system", options:["None","Local alarm","Monitored alarm","Unknown"] },
  { key:"knoxBox", label:"Knox Box", options:["None","Exterior Knox Box","Interior Knox Box","Multiple Knox Boxes","Unknown"] },
  { key:"riser", label:"Riser", options:["None","Wet","Dry","Combination","Unknown"] },
  { key:"fdc", label:"FDC", options:["None","Single inlet","Siamese / two-way","Multiple FDCs","Unknown"] },
  { key:"sprinklerSystem", label:"Sprinkler system", options:["None","Wet","Dry","Pre-action","Deluge","Combination","Partial coverage","Unknown"] },
] as const;
const nowLocal=()=>{const date=new Date(Date.now()-new Date().getTimezoneOffset()*60000);return date.toISOString().slice(0,16);};
const emptyHydrant=(point:Point):Hydrant=>({id:"",hydrantNumber:"",address:"",latitude:point.lat,longitude:point.lng,serviceStatus:"in_service",manufacturer:"",model:"",portCount:2,portSizes:["2.5","4.5"],notes:"",flushes:[],flowTests:[]});

function world(point:Point,zoom:number) { const scale=256*2**zoom; return {x:(point.lng+180)/360*scale,y:(1-Math.asinh(Math.tan(point.lat*Math.PI/180))/Math.PI)/2*scale}; }
function project(point:Point, center:Point, zoom:number, width:number, height:number) {
  const p = world(point,zoom), c = world(center,zoom);
  return { x:width / 2 + p.x - c.x, y:height / 2 + p.y - c.y };
}
function unproject(x:number,y:number,center:Point,zoom:number,width:number,height:number):Point {
  const scale = 256 * 2 ** zoom;
  const centerX = (center.lng + 180) / 360 * scale;
  const centerY = (1 - Math.asinh(Math.tan(center.lat * Math.PI / 180)) / Math.PI) / 2 * scale;
  const wx = centerX + x - width / 2, wy = centerY + y - height / 2;
  return { lng:wx / scale * 360 - 180, lat:Math.atan(Math.sinh(Math.PI * (1 - 2 * wy / scale))) * 180 / Math.PI };
}
function polygon(points:Point[],center:Point,zoom:number,width:number,height:number) { return points.map((point) => { const p=project(point,center,zoom,width,height); return `${p.x},${p.y}`; }).join(" "); }
function operationalPoint(point:OperationalMapPoint,footprint:Point[]):Point|null{
  if("lat" in point&&Number.isFinite(point.lat)&&Number.isFinite(point.lng))return {lat:point.lat,lng:point.lng};
  if(!("x" in point)||!footprint.length)return null;
  const latitudes=footprint.map((item)=>item.lat),longitudes=footprint.map((item)=>item.lng),north=Math.max(...latitudes),south=Math.min(...latitudes),west=Math.min(...longitudes),east=Math.max(...longitudes);
  return {lat:north-point.y*Math.max(north-south,.000001),lng:west+point.x*Math.max(east-west,.000001)};
}
function operationalPoints(value:unknown,footprint:Point[]):Point[]{
  if(!Array.isArray(value))return [];
  return value.map((point)=>operationalPoint(point as OperationalMapPoint,footprint)).filter((point):point is Point=>Boolean(point));
}
function HydrantIcon({outOfService=false}:{outOfService?:boolean}){return <svg viewBox="0 0 32 40" aria-hidden="true"><path d="M11 4h10v5h4v5h3v7h-5v14H9V21H4v-7h3V9h4V4Zm1 9v6h8v-6h-8Zm0 10v9h8v-9h-8Z"/>{outOfService&&<path className="hydrant-oos-slash" d="M3 4 29 36"/>}</svg>;}

function DeleteRecordControl({kind,name,busy,onConfirm}:{kind:"preplan"|"hydrant";name:string;busy:boolean;onConfirm:()=>Promise<void>}){
  const [confirming,setConfirming]=useState(false);
  if(!confirming)return <button className="delete-record-button" disabled={busy} onClick={()=>setConfirming(true)}>Delete {kind}</button>;
  return <div className="delete-record-confirm" role="alert"><strong>Delete {kind}?</strong><span>This permanently removes {name} and its linked records.</span><div><button disabled={busy} onClick={()=>setConfirming(false)}>Cancel</button><button className="confirm-delete-button" disabled={busy} onClick={()=>void onConfirm()}>{busy?"Deleting…":"Confirm Delete"}</button></div></div>;
}

function DeleteFeatureControl({name,busy,onConfirm}:{name:string;busy:boolean;onConfirm:()=>Promise<void>}){
  const [confirming,setConfirming]=useState(false);
  if(!confirming)return <button type="button" className="mapped-feature-delete-button" disabled={busy} onClick={()=>setConfirming(true)}>Delete feature</button>;
  return <div className="mapped-feature-delete-confirm" role="alert"><span>Delete {name}? Its map marker and attached photos will also be removed.</span><div><button type="button" disabled={busy} onClick={()=>setConfirming(false)}>Cancel</button><button type="button" className="confirm-delete-button" disabled={busy} onClick={()=>void onConfirm()}>{busy?"Deleting…":"Confirm Delete"}</button></div></div>;
}

function PreplanContactsEditor({contacts,onChange}:{contacts:PreplanContact[];onChange:(contacts:PreplanContact[])=>void}){
  const updateContact=(contactIndex:number,next:PreplanContact)=>onChange(contacts.map((contact,index)=>index===contactIndex?next:contact));
  return <fieldset className="preplan-contacts-editor">
    <legend>Building contacts</legend>
    <p>Add each contact once, then add as many cell or work numbers as needed.</p>
    {contacts.length===0&&<div className="preplan-contacts-empty">No contacts added yet.</div>}
    {contacts.map((contact,contactIndex)=><section className="preplan-contact-card" key={contact.id}>
      <header><strong>Contact {contactIndex+1}</strong><button type="button" onClick={()=>onChange(contacts.filter((_,index)=>index!==contactIndex))}>Remove contact</button></header>
      <label>Contact name<input value={contact.name} onChange={(event)=>updateContact(contactIndex,{...contact,name:event.target.value})} placeholder="Full name or business contact" autoComplete="name"/></label>
      <div className="preplan-contact-phones">
        {contact.phones.map((phone,phoneIndex)=><div className="preplan-contact-phone" key={phone.id}>
          <label>Phone type<select value={phone.type} onChange={(event)=>updateContact(contactIndex,{...contact,phones:contact.phones.map((item,index)=>index===phoneIndex?{...item,type:event.target.value as "Cell"|"Work"}:item)})}><option value="Cell">Cell</option><option value="Work">Work</option></select></label>
          <label>Phone number<input type="tel" inputMode="tel" value={phone.number} onChange={(event)=>updateContact(contactIndex,{...contact,phones:contact.phones.map((item,index)=>index===phoneIndex?{...item,number:event.target.value}:item)})} placeholder="(708) 555-0123" autoComplete="tel"/></label>
          <button type="button" aria-label={`Remove phone number ${phoneIndex+1} for contact ${contactIndex+1}`} onClick={()=>updateContact(contactIndex,{...contact,phones:contact.phones.filter((_,index)=>index!==phoneIndex)})}>Remove number</button>
        </div>)}
      </div>
      <button type="button" className="preplan-add-phone" onClick={()=>updateContact(contactIndex,{...contact,phones:[...contact.phones,createPreplanPhone()]})}>+ Add another number</button>
    </section>)}
    <button type="button" className="preplan-add-contact" onClick={()=>onChange([...contacts,createPreplanContact()])}>+ Add another contact</button>
  </fieldset>;
}

function directionsUrl(point:Point,travelMode:"driving"|"walking"="driving"){
  const destination=encodeURIComponent(`${point.lat},${point.lng}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=${travelMode}`;
}

function PreplanRecordView({plan,canEdit,onEdit,onShowFeature}:{plan:Preplan;canEdit:boolean;onEdit:()=>void;onShowFeature:(feature:Feature)=>void}){
  const contacts=parsePreplanContacts(plan.contactInfo).filter((contact)=>contact.name.trim()||contact.phones.some((phone)=>phone.number.trim()));
  const systems=quickSystemFields.map(({key,label})=>({label,value:plan[key]})).filter((item)=>item.value.trim());
  const exteriorPhotos=plan.photos.filter((photo)=>!photo.featureId&&["A","B","C","D"].includes(photo.side));
  const constructionLabel=constructionOptions.find((item)=>item.value===simpleConstruction(plan.constructionType))?.label||"Not classified";
  return <section className="preplan-record-view" aria-label={`${plan.businessName} preplan record`}>
    <header className="preplan-record-hero">
      <div><span>OPERATIONAL PREPLAN</span><h2>{plan.businessName}</h2><p>{plan.address||"A-side GPS location"}</p></div>
      <div className="preplan-record-actions">
        <a href={directionsUrl({lat:plan.latitude,lng:plan.longitude})} target="_blank" rel="noreferrer">Directions to building ↗</a>
        {canEdit&&<button type="button" onClick={onEdit}>Edit Preplan</button>}
      </div>
    </header>
    <div className="preplan-record-metrics">
      <article><span>STATUS</span><strong>{plan.status||"Quick Preplan"}</strong></article>
      <article><span>BUILDING</span><strong>{constructionLabel}</strong><small>{plan.floorCount||1} floor level{plan.floorCount===1?"":"s"}</small></article>
      <article><span>FOOTPRINT</span><strong>{Math.round(plan.footprintSquareFeet||polygonAreaSquareFeet(plan.footprint)).toLocaleString()} sq ft</strong><small>{plan.footprint.length} mapped corners</small></article>
      <article><span>FIRE FLOW</span><strong>{plan.suggestedFireFlowGpm?`${plan.suggestedFireFlowGpm.toLocaleString()} GPM`:"Needs review"}</strong><small>{plan.suggestedFireFlowDuration?`${plan.suggestedFireFlowDuration} hr duration`:"No duration entered"}</small></article>
    </div>
    <div className="preplan-record-grid">
      <article className="preplan-record-card preplan-record-building">
        <header><span>1</span><div><h3>Building information</h3><p>Read-only response details</p></div></header>
        <dl>
          <div><dt>Construction</dt><dd>{plan.construction||constructionLabel}</dd></div>
          <div><dt>Access concerns</dt><dd>{plan.accessInfo||"No access concerns entered."}</dd></div>
          <div><dt>Automatic sprinkler</dt><dd>{plan.sprinklerStandard==="none"?"No":plan.sprinklerStandard?"Yes":"Not entered"}</dd></div>
          <div><dt>Last updated</dt><dd>{plan.updatedAt?new Date(plan.updatedAt).toLocaleString():"Not available"}{plan.updatedBy?` · ${plan.updatedBy}`:""}</dd></div>
        </dl>
      </article>
      <article className="preplan-record-card preplan-record-contacts">
        <header><span>2</span><div><h3>Building contacts</h3><p>Tap a number to call</p></div></header>
        {contacts.length?<div>{contacts.map((contact)=><section key={contact.id}><strong>{contact.name||"Building contact"}</strong>{contact.phones.filter((phone)=>phone.number.trim()).map((phone)=><a key={phone.id} href={`tel:${phone.number.replace(/[^\d+]/g,"")}`}><span>{phone.type}</span>{phone.number}</a>)}</section>)}</div>:<p className="preplan-record-empty">No contacts have been added.</p>}
      </article>
      <article className="preplan-record-card preplan-record-quick-systems">
        <header><span>3</span><div><h3>Quick system status</h3><p>Building-level summary</p></div></header>
        {systems.length?<dl>{systems.map((item)=><div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>:<p className="preplan-record-empty">No quick system information has been entered.</p>}
      </article>
    </div>
    <article className="preplan-record-card preplan-record-features">
      <header><span>4</span><div><h3>Mapped operational systems</h3><p>Open walking directions to the exact mapped location.</p></div><b>{plan.features.length}</b></header>
      {plan.features.length?<div className="preplan-record-feature-list">{plan.features.map((feature)=>{const name=feature.label||pinMeta[feature.featureType]?.label||"Operational feature",photos=plan.photos.filter((photo)=>photo.featureId===feature.id);return <section key={feature.id} className="preplan-record-feature">
        <div className="preplan-record-feature-heading"><span className={`feature-symbol ${feature.featureType}`}>{pinMeta[feature.featureType]?.short||"•"}</span><div><strong>{name}</strong><small>{feature.systemType||"Type not entered"} · {feature.serviceStatus.replaceAll("_"," ")}</small></div></div>
        <p>{feature.details||"No additional details entered."}</p>
        {photos.length?<div className="preplan-record-feature-photos">{photos.map((photo)=><img src={photo.url} alt={photo.caption||`${name} feature`} key={photo.id}/>)}</div>:<small className="preplan-record-no-photo">No feature photo added.</small>}
        <div className="preplan-record-feature-actions"><button type="button" onClick={()=>onShowFeature(feature)}>Show on preplan map</button><a href={directionsUrl({lat:feature.latitude,lng:feature.longitude},"walking")} target="_blank" rel="noreferrer">Walking directions ↗</a></div>
      </section>})}</div>:<div className="preplan-record-empty preplan-record-feature-empty"><strong>No mapped systems have been added.</strong><span>An administrator can add Knox Boxes, FDCs, risers, alarm panels, shutoffs and other operational features.</span></div>}
    </article>
    <article className="preplan-record-card preplan-record-photos">
      <header><span>5</span><div><h3>Building exterior photos</h3><p>A, B, C and D sides</p></div><b>{exteriorPhotos.length}</b></header>
      {exteriorPhotos.length?<div>{exteriorPhotos.map((photo)=><figure key={photo.id}><img src={photo.url} alt={photo.caption||`${photo.side} side`}/><figcaption>{photo.side} Side{photo.caption?` · ${photo.caption}`:""}</figcaption></figure>)}</div>:<p className="preplan-record-empty">No exterior photos have been added.</p>}
    </article>
  </section>;
}

function FieldMap({ apiKey,center,zoom,imagery,plans,hydrants,selected,draft,mode,footprintAccepted,operationalOverlay,operationalDraft,onMapClick,onSelect,onHydrantSelect,onCenter,onZoom,onProviderChange }:{ apiKey:string;center:Point;zoom:number;imagery:"aerial"|"street";plans:Preplan[];hydrants:Hydrant[];selected:string;draft:Form|null;mode:string;footprintAccepted:boolean;operationalOverlay:OperationalMapOverlay|null;operationalDraft:OperationalMapDraft;onMapClick:(point:Point)=>void;onSelect:(id:string)=>void;onHydrantSelect:(id:string)=>void;onCenter:(point:Point)=>void;onZoom:(zoom:number)=>void;onProviderChange:(provider:"google"|"fallback")=>void }) {
  const mapRoot=useRef<HTMLDivElement>(null);
  const [dimensions,setDimensions]=useState({width:1100,height:720});
  const {width,height}=dimensions,centerWorld=world(center,zoom),tileX=Math.floor(centerWorld.x/256),tileY=Math.floor(centerWorld.y/256),tileCount=2**zoom;
  const gesture=useRef<{x:number;y:number;center:Point;moved:boolean}|null>(null);
  const [dragging,setDragging]=useState(false),[googleReady,setGoogleReady]=useState(false),[googleFailed,setGoogleFailed]=useState(false);
  useEffect(()=>{const element=mapRoot.current;if(!element)return;const update=()=>{const rect=element.getBoundingClientRect();if(rect.width>0&&rect.height>0)setDimensions({width:rect.width,height:rect.height});};update();const observer=new ResizeObserver(update);observer.observe(element);return()=>observer.disconnect();},[]);
  const tiles=Array.from({length:49},(_,index)=>({x:tileX+index%7-3,y:tileY+Math.floor(index/7)-3})).filter((item)=>item.y>=0&&item.y<tileCount);
  const mappedHydrants=hydrants.map((hydrant)=>({hydrant,p:project({lat:hydrant.latitude,lng:hydrant.longitude},center,zoom,width,height)})).filter((item)=>item.p.x>-50&&item.p.x<width+50&&item.p.y>-50&&item.p.y<height+50);
  const selectedPlan=selected?plans.find((plan)=>plan.id===selected):null;
  const selectedFootprint=selectedPlan?.footprint??draft?.footprint??[];
  const mappedSpaces=(operationalOverlay?.spaces??[]).map((item)=>({...item,points:operationalPoints(item.geometry,selectedFootprint)})).filter((item)=>item.points.length>=3);
  const mappedHoseLays=(operationalOverlay?.hoseLays??[]).map((item)=>({...item,points:operationalPoints(item.path,selectedFootprint)})).filter((item)=>item.points.length>=2);
  const mappedOperationalDraft=operationalDraft?operationalPoints(operationalDraft.points,selectedFootprint):[];
  const operationalASide=operationalDraft&&draft?project({lat:draft.aSideLatitude??draft.latitude,lng:draft.aSideLongitude??draft.longitude},center,zoom,width,height):null;
  const visibleFeatures=zoom>=18?(selectedPlan?.features??[]):[];
  const featurePinSize=Math.max(18,Math.min(32,18+(zoom-18)*7));
  const showIndividual=zoom>=17&&mappedHydrants.length<=24;
  const clusters=[...mappedHydrants.reduce((map,item)=>{const key=`${Math.floor(item.p.x/120)}-${Math.floor(item.p.y/120)}`,group=map.get(key)??[];group.push(item);map.set(key,group);return map;},new Map<string,typeof mappedHydrants>()).values()];
  function mapPoint(element:HTMLDivElement,clientX:number,clientY:number,base=center){const rect=element.getBoundingClientRect();return unproject((clientX-rect.left)/rect.width*width,(clientY-rect.top)/rect.height*height,base,zoom,width,height);}
  return <div ref={mapRoot} className={`field-map ${mode ? "capture" : ""}${dragging ? " dragging" : ""}${googleReady ? " google-active" : ""}`}
    onPointerDown={(event)=>{if(googleReady||event.button!==0)return;event.currentTarget.setPointerCapture(event.pointerId);gesture.current={x:event.clientX,y:event.clientY,center,moved:false};setDragging(true);}}
    onPointerMove={(event)=>{if(googleReady)return;const start=gesture.current;if(!start)return;const dx=event.clientX-start.x,dy=event.clientY-start.y;if(Math.hypot(dx,dy)>4)start.moved=true;if(start.moved){const rect=event.currentTarget.getBoundingClientRect();onCenter(unproject(width/2-dx/rect.width*width,height/2-dy/rect.height*height,start.center,zoom,width,height));}}}
    onPointerUp={(event)=>{if(googleReady)return;const start=gesture.current;gesture.current=null;setDragging(false);if(start&&!start.moved&&mode)onMapClick(mapPoint(event.currentTarget,event.clientX,event.clientY));}}
    onPointerCancel={()=>{gesture.current=null;setDragging(false);}}
    onDoubleClick={(event)=>{if(googleReady)return;event.preventDefault();onCenter(mapPoint(event.currentTarget,event.clientX,event.clientY));onZoom(Math.min(21,zoom+1));}}
    onWheel={(event)=>{if(googleReady)return;event.preventDefault();onZoom(Math.max(14,Math.min(21,zoom+(event.deltaY<0?1:-1))));}}>
    <div className="field-map-tiles">{tiles.map((item)=>{const wrappedX=((item.x%tileCount)+tileCount)%tileCount,left=width/2+item.x*256-centerWorld.x,top=height/2+item.y*256-centerWorld.y;return <img key={`${item.x}-${item.y}`} alt="" draggable={false} style={{left:`${left/width*100}%`,top:`${top/height*100}%`,width:`${256/width*100}%`,height:`${256/height*100}%`}} src={imagery === "aerial" ? `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${item.y}/${wrappedX}` : `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${item.y}.png`}/>;})}</div>
    {apiKey&&!googleFailed&&<GoogleFieldMap apiKey={apiKey} center={center} zoom={zoom} imagery={imagery} interactive={!mode} onReady={(ready)=>{setGoogleReady(ready);setGoogleFailed(!ready);onProviderChange(ready?"google":"fallback");}} onViewChange={(nextCenter,nextZoom)=>{onCenter(nextCenter);onZoom(nextZoom);}}/>}
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-label="Preplan map overlay">
      {plans.map((plan) => plan.footprint.length >= 3 && <polygon key={plan.id} points={polygon(plan.footprint,center,zoom,width,height)} className={plan.id === selected ? "selected" : ""} onClick={(event) => { event.stopPropagation(); onSelect(plan.id); }}/>)}
      {draft?.footprint && draft.footprint.length > 0 && <>{draft.footprint.length>=3&&<polygon points={polygon(draft.footprint,center,zoom,width,height)} className={`draft-footprint${footprintAccepted?" accepted":""}`}/>} {!footprintAccepted&&<polyline points={polygon(draft.footprint,center,zoom,width,height)} className="draft"/>}{draft.footprint.map((point,index) => { const p=project(point,center,zoom,width,height); return <g key={index} className="corner-point"><circle cx={p.x} cy={p.y} r={footprintAccepted?7:10} className={`corner${footprintAccepted?" accepted":""}`}/><text x={p.x} y={p.y+4}>{index+1}</text></g>; })}</>}
      {mappedSpaces.map((space)=><g className="operational-space-map-overlay" key={`space-${space.id}`}><polygon points={polygon(space.points,center,zoom,width,height)}/><text x={project(space.points.reduce((sum,point)=>({lat:sum.lat+point.lat/space.points.length,lng:sum.lng+point.lng/space.points.length}),{lat:0,lng:0}),center,zoom,width,height).x} y={project(space.points.reduce((sum,point)=>({lat:sum.lat+point.lat/space.points.length,lng:sum.lng+point.lng/space.points.length}),{lat:0,lng:0}),center,zoom,width,height).y}>{String(space.name??"Room")}</text></g>)}
      {mappedHoseLays.map((lay)=><polyline className="operational-hose-map-overlay" key={`hose-${lay.id}`} points={polygon(lay.points,center,zoom,width,height)}/>)}
      {operationalDraft?.kind==="space"&&mappedOperationalDraft.length>0&&<><polygon className="operational-space-map-overlay draft" points={polygon(mappedOperationalDraft,center,zoom,width,height)}/>{mappedOperationalDraft.map((point,index)=>{const p=project(point,center,zoom,width,height);return <circle className="operational-map-corner" key={`space-draft-${index}`} cx={p.x} cy={p.y} r="8"/>;})}</>}
      {operationalDraft?.kind==="hoseLay"&&mappedOperationalDraft.length>0&&<><polyline className="operational-hose-map-overlay draft" points={polygon(mappedOperationalDraft,center,zoom,width,height)}/>{mappedOperationalDraft.map((point,index)=>{const p=project(point,center,zoom,width,height);return <circle className="operational-map-route-point" key={`hose-draft-${index}`} cx={p.x} cy={p.y} r="8"/>;})}</>}
    </svg>
    {operationalOverlay&&<div className="operational-map-level-badge"><strong>{operationalOverlay.levelName}</strong><span>{mappedSpaces.length} room{mappedSpaces.length===1?"":"s"} · {mappedHoseLays.length} hose lay{mappedHoseLays.length===1?"":"s"}</span></div>}
    {operationalASide&&<span className="a-side-marker" style={{left:`${operationalASide.x/width*100}%`,top:`${operationalASide.y/height*100}%`}}>A</span>}
    {operationalDraft&&<div className="capture-instruction">{operationalDraft.kind==="space"?"Click room corners on this level":"Click the route to add a bend"}</div>}
    {visibleFeatures.map((feature) => { const p=project({lat:feature.latitude,lng:feature.longitude},center,zoom,width,height); const meta=pinMeta[feature.featureType] ?? {short:"•",label:feature.label}; return <button key={feature.id} className={`field-pin ${feature.featureType}`} style={{left:`${p.x/width*100}%`,top:`${p.y/height*100}%`,width:featurePinSize,height:featurePinSize,fontSize:Math.max(9,featurePinSize*.42)}} title={`${meta.label}: ${feature.label || feature.details}`} onClick={(event) => {event.stopPropagation();if(selectedPlan)onSelect(selectedPlan.id);}}>{meta.short}</button>; })}
    {showIndividual?mappedHydrants.map(({hydrant,p})=><button key={hydrant.id} className={`hydrant-map-pin ${hydrant.serviceStatus}`} style={{left:`${p.x/width*100}%`,top:`${p.y/height*100}%`,scale:String(Math.max(.7,Math.min(1.15,.72+(zoom-17)*.14)))}} title={`${hydrant.hydrantNumber||"Hydrant"} · ${hydrant.serviceStatus.replaceAll("_"," ")}`} onClick={(event)=>{event.stopPropagation();onHydrantSelect(hydrant.id);}}><HydrantIcon outOfService={hydrant.serviceStatus==="out_of_service"}/></button>):clusters.map((group)=>{const x=group.reduce((sum,item)=>sum+item.p.x,0)/group.length,y=group.reduce((sum,item)=>sum+item.p.y,0)/group.length;return <button key={group.map((item)=>item.hydrant.id).join("-")} className="hydrant-cluster" style={{left:`${x/width*100}%`,top:`${y/height*100}%`}} onClick={(event)=>{event.stopPropagation();onCenter({lat:group[0].hydrant.latitude,lng:group[0].hydrant.longitude});onZoom(Math.min(20,zoom+2));}}><i/><b>×{group.length}</b></button>;})}
    {googleReady&&mode&&<div className="google-capture-layer"
      onPointerDown={(event)=>{if(event.button!==0)return;event.currentTarget.setPointerCapture(event.pointerId);gesture.current={x:event.clientX,y:event.clientY,center,moved:false};setDragging(true);}}
      onPointerMove={(event)=>{const start=gesture.current;if(!start)return;const dx=event.clientX-start.x,dy=event.clientY-start.y;if(Math.hypot(dx,dy)>4)start.moved=true;if(start.moved){const rect=event.currentTarget.getBoundingClientRect();onCenter(unproject(width/2-dx/rect.width*width,height/2-dy/rect.height*height,start.center,zoom,width,height));}}}
      onPointerUp={(event)=>{const start=gesture.current;gesture.current=null;setDragging(false);if(start&&!start.moved)onMapClick(mapPoint(event.currentTarget,event.clientX,event.clientY));}}
      onPointerCancel={()=>{gesture.current=null;setDragging(false);}}
      onDoubleClick={(event)=>{event.preventDefault();onCenter(mapPoint(event.currentTarget,event.clientX,event.clientY));onZoom(Math.min(21,zoom+1));}}
      onWheel={(event)=>{event.preventDefault();onZoom(Math.max(14,Math.min(21,zoom+(event.deltaY<0?1:-1))));}}/>}
    {!googleReady&&<small className="map-credit">{imagery === "aerial" ? "Esri World Imagery" : "© OpenStreetMap contributors"}</small>}
  </div>;
}

export default function FieldPreplans() {
  const [plans,setPlans]=useState<Preplan[]>([]),[canEdit,setCanEdit]=useState(false),[canDeletePreplan,setCanDeletePreplan]=useState(false),[query,setQuery]=useState(""),[selected,setSelected]=useState(""),[draft,setDraft]=useState<Form|null>(null);
  const [focusedPreplan,setFocusedPreplan]=useState(false);
  const [recordMode,setRecordMode]=useState<"view"|"edit">("view");
  const [directoryView,setDirectoryView]=useState<"map"|"starters">("map"),[quickStep,setQuickStep]=useState<1|2|3>(1),[detailsStep,setDetailsStep]=useState<"overview"|"add"|"systems">("overview"),[photoSide,setPhotoSide]=useState<"A"|"B"|"C"|"D">("A");
  const [imports,setImports]=useState<ImportedBuilding[]>([]),[selectedImport,setSelectedImport]=useState("");
  const [importSort,setImportSort]=useState<"street"|"completion">("street"),[geocodeProgress,setGeocodeProgress]=useState("");
  const [hydrants,setHydrants]=useState<Hydrant[]>([]),[hydrantDraft,setHydrantDraft]=useState<Hydrant|null>(null),[hydrantTab,setHydrantTab]=useState<"quick"|"details"|"flush"|"flow">("quick");
  const [center,setCenter]=useState<Point>(stickney),[zoom,setZoom]=useState(19),[imagery,setImagery]=useState<"aerial"|"street">("aerial"),[mode,setMode]=useState(""),[tab,setTab]=useState<"quick"|"details"|"photos"|"operational">("quick");
  const [locationState,setLocationState]=useState<LocationState>("locating");
  const [mapExpanded,setMapExpanded]=useState(false);
  const [footprintAccepted,setFootprintAccepted]=useState(false);
  const [operationalOverlay,setOperationalOverlay]=useState<OperationalMapOverlay|null>(null),[operationalMapDraft,setOperationalMapDraft]=useState<OperationalMapDraft>(null);
  const [mapsApiKey,setMapsApiKey]=useState(""),[mapProvider,setMapProvider]=useState<"loading"|"google"|"fallback">("loading");
  const [feature,setFeature]=useState({featureType:"knox",label:"",systemType:"",serviceStatus:"in_service",details:""}),[featurePhoto,setFeaturePhoto]=useState<File|null>(null),[featureLocating,setFeatureLocating]=useState(false),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  const featurePhotoInput=useRef<HTMLInputElement|null>(null);
  const focusMapPanel=useRef<HTMLDivElement|null>(null);
  const handleOperationalOverlay=useCallback((overlay:OperationalMapOverlay)=>setOperationalOverlay(overlay),[]);
  const startOperationalDrawing=useCallback((kind:"space"|"hoseLay",levelId:string)=>{setOperationalMapDraft({kind,levelId,points:[]});setImagery("street");setMode("");focusMapPanel.current?.scrollIntoView({behavior:"smooth",block:"start"});},[]);
  const changeOperationalDrawing=useCallback((next:OperationalMapDraft)=>{
    setOperationalMapDraft(next);
    if(next?.kind==="hoseLay"&&next.points.length===2&&next.points.every((point)=>"lat" in point)){
      const points=next.points as Point[],view=detailedPreplanMapView(points,points[1]);setCenter(view.center);setZoom(view.zoom);
    }
  },[]);
  const [flush,setFlush]=useState({flushedAt:nowLocal(),waterClear:true,issues:"",notes:""});
  const [flow,setFlow]=useState({flowHydrantId:"",testedAt:nowLocal(),staticPressure:"",residualPressure:"",desiredResidual:"20",outletDiameter:"2.5",pitotPressure:"",dischargeCoefficient:".9",notes:""});
  const load=useCallback(async()=>{const response=await fetch("/api/field-preplans",{cache:"no-store"});const body=await response.json() as {preplans?:Preplan[];imports?:ImportedBuilding[];canEdit?:boolean;canDelete?:boolean;error?:string};if(!response.ok)throw new Error(body.error||"Unable to load preplans");setPlans(body.preplans??[]);setImports(body.imports??[]);setCanEdit(Boolean(body.canEdit));setCanDeletePreplan(Boolean(body.canDelete));},[]);
  const loadHydrants=useCallback(async()=>{const response=await fetch("/api/field-hydrants",{cache:"no-store"});const body=await response.json() as {hydrants?:Hydrant[];canEdit?:boolean;error?:string};if(!response.ok)throw new Error(body.error||"Unable to load hydrants");setHydrants(body.hydrants??[]);setCanEdit((current)=>current||Boolean(body.canEdit));},[]);
  useEffect(()=>{
    const initialize=async()=>{
      try{await Promise.all([load(),loadHydrants()]);}catch(error){setMessage(error instanceof Error?error.message:"Unable to load field records");}
      try{const response=await fetch("/api/maps-config",{cache:"no-store"});const body=await response.json() as {configured?:boolean;apiKey?:string};if(response.ok&&body.configured&&body.apiKey)setMapsApiKey(body.apiKey);else setMapProvider("fallback");}catch{setMapProvider("fallback");}
    };
    void initialize();
    const url=new URL(window.location.href);
    const hasFocusedRecord=url.searchParams.has("preplan")||url.searchParams.has("hydrant");
    if(hasFocusedRecord)setLocationState("record");
    else if(!navigator.geolocation)setLocationState("fallback");
    else navigator.geolocation.getCurrentPosition((position)=>{setCenter({lat:position.coords.latitude,lng:position.coords.longitude});setZoom(17);setLocationState("current");},()=>setLocationState("fallback"),{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
  },[load,loadHydrants]);
  useEffect(()=>{
    const syncFocusedPreplan=(fromHistory=false)=>{
      const url=new URL(window.location.href),id=url.searchParams.get("preplan");
      if(!id){setFocusedPreplan(false);if(fromHistory){setSelected("");setDraft(null);setMode("");}return;}
      const plan=plans.find((item)=>item.id===id);
      if(!plan)return;
      setFocusedPreplan(true);
      setRecordMode(url.searchParams.get("edit")==="1"?"edit":"view");
      if(selected!==id){const view=detailedPreplanMapView(plan.footprint,{lat:plan.latitude,lng:plan.longitude});setSelectedImport("");setSelected(plan.id);setDraft(formFromPlan(plan));setFootprintAccepted(true);setCenter(view.center);setZoom(view.zoom);setTab("quick");setQuickStep(1);setHydrantDraft(null);setMode("");}
    };
    syncFocusedPreplan();
    const handlePopState=()=>syncFocusedPreplan(true);
    window.addEventListener("popstate",handlePopState);
    return()=>window.removeEventListener("popstate",handlePopState);
  },[plans,selected]);
  useEffect(()=>{
    const id=new URL(window.location.href).searchParams.get("hydrant");
    if(!id||id==="new"||hydrantDraft?.id===id)return;
    const item=hydrants.find((record)=>record.id===id);
    if(!item)return;
    setHydrantDraft({...item});setSelected("");setDraft(null);setFocusedPreplan(false);setHydrantTab("quick");setCenter({lat:item.latitude,lng:item.longitude});setZoom(20);setMode("");
  },[hydrants,hydrantDraft?.id]);
  useEffect(()=>{
    if(!mapExpanded)return;
    const previousOverflow=document.body.style.overflow;
    const closeExpandedMap=(event:KeyboardEvent)=>{if(event.key==="Escape")setMapExpanded(false);};
    document.body.style.overflow="hidden";
    window.addEventListener("keydown",closeExpandedMap);
    return()=>{document.body.style.overflow=previousOverflow;window.removeEventListener("keydown",closeExpandedMap);};
  },[mapExpanded]);
  const normalizedQuery=query.trim().toLocaleLowerCase();
  const shown=useMemo(()=>{const span=360/(2**zoom)*1.6;return plans.filter((plan)=>{
    const matchesSearch=!normalizedQuery||`${plan.businessName} ${plan.address} ${plan.status}`.toLocaleLowerCase().includes(normalizedQuery);
    const isOnMap=Math.abs(plan.longitude-center.lng)<span&&Math.abs(plan.latitude-center.lat)<span;
    return matchesSearch&&(normalizedQuery?true:isOnMap);
  });},[plans,normalizedQuery,center,zoom]);
  const shownHydrants=useMemo(()=>{const span=360/(2**zoom)*1.6;return hydrants.filter((item)=>{
    const matchesSearch=!normalizedQuery||`${item.hydrantNumber} ${item.address} ${item.serviceStatus.replaceAll("_"," ")}`.toLocaleLowerCase().includes(normalizedQuery);
    const isOnMap=Math.abs(item.longitude-center.lng)<span&&Math.abs(item.latitude-center.lat)<span;
    return matchesSearch&&(normalizedQuery?true:isOnMap);
  });},[hydrants,normalizedQuery,center,zoom]);
  const shownImports=useMemo(()=>imports.filter((item)=>`${item.businessName} ${item.address}`.toLowerCase().includes(query.toLowerCase())).toSorted((a,b)=>{
    if(importSort==="completion"){const status=Number(a.status==="completed")-Number(b.status==="completed");if(status)return status;}
    return a.address.localeCompare(b.address,undefined,{numeric:true})||a.businessName.localeCompare(b.businessName);
  }),[imports,query,importSort]);
  const groupedImports=useMemo(()=>[...shownImports.reduce((groups,item)=>{const street=item.address.replace(/^\s*\d+[a-z]?\s+/i,"").replace(/\s+(?:rd|road|st|street|ave|avenue)\.?$/i,(value)=>value.trim()).trim()||"Other";const rows=groups.get(street)??[];rows.push(item);groups.set(street,rows);return groups;},new Map<string,ImportedBuilding[]>())],[shownImports]);
  const current=plans.find((plan)=>plan.id===selected);
  const selectedHydrant=hydrantDraft?.id?hydrants.find((item)=>item.id===hydrantDraft.id):null;
  function openPreplanUrl(id:string,replace=false,editMode=false){const url=new URL(window.location.href);url.searchParams.delete("hydrant");url.searchParams.set("preplan",id);if(editMode)url.searchParams.set("edit","1");else url.searchParams.delete("edit");window.history[replace?"replaceState":"pushState"]({preplanId:id},"",`${url.pathname}${url.search}${url.hash}`);}
  function focusPlan(plan:Preplan,nextMode:"view"|"edit") {const view=detailedPreplanMapView(plan.footprint,{lat:plan.latitude,lng:plan.longitude});setMapExpanded(false);setSelectedImport("");setSelected(plan.id);setDraft(formFromPlan(plan));setFootprintAccepted(true);setCenter(view.center);setZoom(view.zoom);setTab("quick");setQuickStep(1);setDetailsStep("overview");setHydrantDraft(null);setMode("");setOperationalOverlay(null);setOperationalMapDraft(null);setRecordMode(nextMode);setFocusedPreplan(true);openPreplanUrl(plan.id,false,nextMode==="edit");window.scrollTo({top:0,behavior:"smooth"});}
  function view(plan:Preplan){focusPlan(plan,"view");}
  function edit(plan:Preplan){focusPlan(plan,"edit");}
  function beginNewPreplan(){const next=empty(center);setSelectedImport("");setDraft(next);setFootprintAccepted(false);setHydrantDraft(null);setSelected("");setTab("quick");setQuickStep(1);setDetailsStep("overview");setMode("footprint");setRecordMode("edit");setFocusedPreplan(true);openPreplanUrl("new",false,true);window.scrollTo({top:0,behavior:"smooth"});}
  function closePreplan(){const url=new URL(window.location.href);url.searchParams.delete("preplan");url.searchParams.delete("edit");window.history.pushState({},"",`${url.pathname}${url.search}${url.hash}`);setFocusedPreplan(false);setSelected("");setSelectedImport("");setDraft(null);setMode("");setOperationalOverlay(null);setOperationalMapDraft(null);setRecordMode("view");window.scrollTo({top:0,behavior:"smooth"});}
  function startImportedBuilding(item:ImportedBuilding){if(item.linkedPreplanId){const plan=plans.find((record)=>record.id===item.linkedPreplanId);if(plan)edit(plan);return;}const resolved=item.latitude!=null&&item.longitude!=null?{lat:item.latitude,lng:item.longitude}:center;const next=empty(resolved);setCenter(resolved);setSelectedImport(item.id);setSelected("");setHydrantDraft(null);setDraft({...next,...addressParts(item.address),businessName:item.businessName,address:item.address,status:item.latitude!=null?"Imported · Footprint Required":"Imported · Location Required"});setFootprintAccepted(false);setTab("quick");setQuickStep(1);setDetailsStep("overview");setMode("footprint");setRecordMode("edit");setFocusedPreplan(true);openPreplanUrl("new",false,true);setMessage(item.latitude!=null?"Address located. Verify the map position, place the building corners, and accept the footprint.":"Address needs manual placement. Move the map to the building, place its corners, and accept the footprint.");window.scrollTo({top:0,behavior:"smooth"});}
  async function batchGeocode(){
    setBusy(true);setGeocodeProgress("Starting address lookup…");setMessage("");
    try{
      let remaining=1,totalGeocoded=0,totalFailed=0;
      for(let batch=0;batch<8&&remaining>0;batch+=1){
        const response=await fetch("/api/field-preplans",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"batchGeocodeImports"})});
        const body=await response.json() as {processed?:number;geocoded?:number;failed?:number;remaining?:number;error?:string};
        if(!response.ok)throw new Error(body.error||"Unable to locate imported addresses.");
        totalGeocoded+=body.geocoded??0;totalFailed+=body.failed??0;remaining=body.remaining??0;
        setGeocodeProgress(`${totalGeocoded} located · ${totalFailed} need review · ${remaining} remaining`);
        if(!body.processed)break;
      }
      await load();
      setMessage(`${totalGeocoded} imported addresses located. ${totalFailed} require manual review.`);
    }catch(error){setMessage(error instanceof Error?error.message:"Unable to locate imported addresses.");}
    finally{setBusy(false);}
  }
  function locate(){if(!navigator.geolocation){setLocationState("fallback");setMessage("This device does not provide location access. Showing Stickney instead.");return;}setLocationState("locating");navigator.geolocation.getCurrentPosition((position)=>{const point={lat:position.coords.latitude,lng:position.coords.longitude};setCenter(point);setZoom(17);setLocationState("current");setMessage("Map centered on this device's current location.");if(draft)setDraft({...draft,latitude:point.lat,longitude:point.lng});},()=>{setCenter(stickney);setZoom(17);setLocationState("fallback");setMessage("Location permission is unavailable. Showing Stickney instead.");},{enableHighAccuracy:true,timeout:12000,maximumAge:60000});}
  const locationLabel=locationState==="locating"?"Locating…":locationState==="current"?"At current location":locationState==="fallback"?"Use current location":"Current location";
  function clickMap(point:Point){
    if(!draft)return;
    if(operationalMapDraft){
      const points=operationalMapDraft.kind==="hoseLay"&&operationalMapDraft.points.length>=2?[operationalMapDraft.points[0],...operationalMapDraft.points.slice(1,-1),point,operationalMapDraft.points.at(-1)!]:[...operationalMapDraft.points,point];
      setOperationalMapDraft({...operationalMapDraft,points});return;
    }
    if(mode==="footprint"){setDraft({...draft,footprint:[...draft.footprint,point]});setFootprintAccepted(false);}
    else if(mode==="aSide"){setDraft({...draft,aSideLatitude:point.lat,aSideLongitude:point.lng,latitude:point.lat,longitude:point.lng});setMode("");}
    else if(pinMeta[mode]&&selected){void saveFeature(point,mode);}
  }
  async function save(payload:object,success:string){setBusy(true);setMessage("");try{const response=await fetch("/api/field-preplans",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});const body=await response.json() as {id?:string;error?:string};if(!response.ok)throw new Error(body.error||"Unable to save");await load();setMessage(success);return body.id;}catch(error){setMessage(error instanceof Error?error.message:"Unable to save");}finally{setBusy(false);}}
  async function savePlan(){if(!draft||!footprintAccepted)return;const address=fullAddress(draft),contactInfo=serializePreplanContacts(draft.contacts);const id=await save({action:"savePreplan",id:draft.id,importId:selectedImport,businessName:draft.businessName,address,location:{lat:draft.latitude,lng:draft.longitude},aSide:draft.aSideLatitude==null?null:{lat:draft.aSideLatitude,lng:draft.aSideLongitude},footprint:draft.footprint,contactInfo,construction:draft.construction,accessInfo:draft.accessInfo,alarmSystem:draft.alarmSystem,knoxBox:draft.knoxBox,riser:draft.riser,fdc:draft.fdc,sprinklerSystem:draft.sprinklerSystem,floorCount:draft.floorCount,constructionType:draft.constructionType,occupancyFlowCategory:draft.occupancyFlowCategory,sprinklerStandard:draft.sprinklerStandard,status:selectedImport?"Quick Preplan":draft.status},"Preplan saved");if(id){setSelectedImport("");setSelected(id);setDraft({...draft,address,contactInfo,id,status:"Quick Preplan"});openPreplanUrl(id,true,true);}}
  async function saveFeature(point:Point,type=feature.featureType){
    if(!selected)return;
    setBusy(true);setMessage("");
    let featureSaved=false;
    try{
      const response=await fetch("/api/field-preplans",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"saveFeature",preplanId:selected,featureType:type,label:feature.label,systemType:feature.systemType,serviceStatus:feature.serviceStatus,details:feature.details,location:point})});
      const body=await response.json() as {id?:string;error?:string};
      if(!response.ok||!body.id)throw new Error(body.error||"Unable to place feature");
      featureSaved=true;
      if(featurePhoto){
        const form=new FormData();form.set("preplanId",selected);form.set("featureId",body.id);form.set("side","FEATURE");form.set("caption",feature.label||pinMeta[type]?.label||"Operational feature");form.set("photo",featurePhoto);
        const photoResponse=await fetch("/api/field-preplans/photos",{method:"POST",body:form});
        const photoBody=await photoResponse.json() as {error?:string};
        if(!photoResponse.ok)throw new Error(photoBody.error||"Unable to save feature photo");
      }
      await load();
      setMessage(`${pinMeta[type]?.label??"Feature"} placed${featurePhoto?" with photo":""}`);setDetailsStep("systems");
      setFeaturePhoto(null);if(featurePhotoInput.current)featurePhotoInput.current.value="";
    }catch(error){
      if(featureSaved)await load().catch(()=>{});
      setMessage(featureSaved?`Feature placed, but its photo was not saved: ${error instanceof Error?error.message:"Unable to upload photo"}`:error instanceof Error?error.message:"Unable to place feature");
    }finally{setBusy(false);setMode("");}
  }
  function placeFeatureAtCurrentLocation(){
    if(!navigator.geolocation){setMessage("This device does not provide GPS location access. Use the map to place the feature instead.");return;}
    setFeatureLocating(true);setMessage("Finding this device's current location…");
    navigator.geolocation.getCurrentPosition((position)=>{
      const point={lat:position.coords.latitude,lng:position.coords.longitude};
      setCenter(point);setZoom(20);setLocationState("current");
      void saveFeature(point).finally(()=>setFeatureLocating(false));
    },()=>{setFeatureLocating(false);setMessage("Current location permission is unavailable. Use the map to place the feature instead.");},{enableHighAccuracy:true,timeout:15000,maximumAge:15000});
  }
  async function uploadFeaturePhoto(event:React.ChangeEvent<HTMLInputElement>,item:Feature){
    const input=event.currentTarget,file=input.files?.[0];if(!file||!selected)return;
    const form=new FormData();form.set("preplanId",selected);form.set("featureId",item.id);form.set("side","FEATURE");form.set("caption",item.label||pinMeta[item.featureType]?.label||"Operational feature");form.set("photo",file);
    setBusy(true);setMessage("");
    try{const response=await fetch("/api/field-preplans/photos",{method:"POST",body:form});const body=await response.json() as {error?:string};if(!response.ok)throw new Error(body.error||"Unable to upload feature photo");await load();setMessage(`${item.label||pinMeta[item.featureType]?.label||"Feature"} photo saved`);}catch(error){setMessage(error instanceof Error?error.message:"Unable to upload feature photo");}finally{setBusy(false);input.value="";}
  }
  async function upload(event:React.ChangeEvent<HTMLInputElement>,side:string){const file=event.target.files?.[0];if(!file||!selected)return;const form=new FormData();form.set("preplanId",selected);form.set("side",side);form.set("photo",file);setBusy(true);try{const response=await fetch("/api/field-preplans/photos",{method:"POST",body:form});const body=await response.json() as {error?:string};if(!response.ok)throw new Error(body.error||"Unable to upload");await load();setMessage(`${side}-side photo saved`);}catch(error){setMessage(error instanceof Error?error.message:"Unable to upload");}finally{setBusy(false);event.target.value="";}}
  async function saveHydrantAction(payload:object,success:string){setBusy(true);setMessage("");try{const response=await fetch("/api/field-hydrants",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});const body=await response.json() as {id?:string;error?:string;measuredFlow?:number;availableFlow?:number};if(!response.ok)throw new Error(body.error||"Unable to save hydrant");await loadHydrants();setMessage(body.availableFlow?`${success} · ${Math.round(body.measuredFlow||0).toLocaleString()} GPM flowed · ${Math.round(body.availableFlow).toLocaleString()} GPM available` : success);return body.id;}catch(error){setMessage(error instanceof Error?error.message:"Unable to save hydrant");}finally{setBusy(false);}}
  function openHydrantUrl(id:string,replace=false){const url=new URL(window.location.href);url.searchParams.delete("preplan");url.searchParams.set("hydrant",id);window.history[replace?"replaceState":"pushState"]({hydrantId:id},"",`${url.pathname}${url.search}${url.hash}`);}
  function addHydrant(){const start=(point:Point)=>{setCenter(point);setHydrantDraft(emptyHydrant(point));setHydrantTab("quick");setDraft(null);setSelected("");openHydrantUrl("new");window.scrollTo({top:0,behavior:"smooth"});};navigator.geolocation?.getCurrentPosition((position)=>start({lat:position.coords.latitude,lng:position.coords.longitude}),()=>start(center),{enableHighAccuracy:true,timeout:8000});}
  async function saveHydrant(){if(!hydrantDraft)return;const id=await saveHydrantAction({action:"saveHydrant",...hydrantDraft},"Hydrant saved at current GPS location");if(id){setHydrantDraft({...hydrantDraft,id});openHydrantUrl(id,true);}}
  function openHydrant(id:string){const item=hydrants.find((hydrant)=>hydrant.id===id);if(!item)return;setMapExpanded(false);setHydrantDraft({...item});setHydrantTab("details");setDraft(null);setSelected("");setCenter({lat:item.latitude,lng:item.longitude});setZoom(20);openHydrantUrl(id);window.scrollTo({top:0,behavior:"smooth"});}
  function closeHydrant(){const url=new URL(window.location.href);url.searchParams.delete("hydrant");window.history.pushState({},"",`${url.pathname}${url.search}${url.hash}`);setHydrantDraft(null);window.scrollTo({top:0,behavior:"smooth"});}
  async function deleteHydrant(id:string){setBusy(true);setMessage("");try{const response=await fetch("/api/field-hydrants",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"deleteHydrant",id,confirmation:"DELETE"})});const body=await response.json() as {error?:string};if(!response.ok)throw new Error(body.error||"Unable to delete hydrant");await loadHydrants();setHydrantDraft(null);const url=new URL(window.location.href);url.searchParams.delete("hydrant");window.history.replaceState({},"",`${url.pathname}${url.search}${url.hash}`);setMessage("Hydrant deleted");}catch(error){setMessage(error instanceof Error?error.message:"Unable to delete hydrant");}finally{setBusy(false);}}
  async function deleteFeature(item:Feature){setBusy(true);setMessage("");try{const response=await fetch("/api/field-preplans",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"deleteFeature",id:item.id,preplanId:item.preplanId,confirmation:"DELETE"})});const body=await response.json() as {error?:string;photoCleanupPending?:boolean};if(!response.ok)throw new Error(body.error||"Unable to delete feature");await load();const name=item.label||pinMeta[item.featureType]?.label||"Feature";setMessage(body.photoCleanupPending?`${name} deleted. One or more stored photos could not be cleaned up.`:`${name} deleted`);}catch(error){setMessage(error instanceof Error?error.message:"Unable to delete feature");}finally{setBusy(false);}}
  async function deletePreplan(id:string){setBusy(true);setMessage("");try{const response=await fetch("/api/field-preplans",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"deletePreplan",id,confirmation:"DELETE"})});const body=await response.json() as {error?:string;photoCleanupPending?:boolean};if(!response.ok)throw new Error(body.error||"Unable to delete preplan");await load();const url=new URL(window.location.href);url.searchParams.delete("preplan");window.history.replaceState({},"",`${url.pathname}${url.search}${url.hash}`);setFocusedPreplan(false);setSelected("");setSelectedImport("");setDraft(null);setMessage(body.photoCleanupPending?"Preplan deleted. One or more stored photos could not be cleaned up.":"Preplan deleted");}catch(error){setMessage(error instanceof Error?error.message:"Unable to delete preplan");}finally{setBusy(false);}}
  const measuredPreview=hydrantOutletFlow(Number(flow.outletDiameter),Number(flow.pitotPressure),Number(flow.dischargeCoefficient));
  const availablePreview=availableHydrantFlow(measuredPreview,Number(flow.staticPressure),Number(flow.residualPressure),Number(flow.desiredResidual));
  const flowClass=nfpa291FlowClass(availablePreview);
  const footprintSquareFeet=draft?Math.round(polygonAreaSquareFeet(draft.footprint)):0;
  const fireFlowPreview=draft?suggestedFireFlow({footprintSquareFeet,floorCount:draft.floorCount,constructionType:draft.constructionType,occupancyFlowCategory:draft.occupancyFlowCategory,sprinklerStandard:draft.sprinklerStandard}):null;
  const mapPlans=draft?.id ? plans.map((plan)=>plan.id===draft.id?{...plan,...draft}:plan) : plans;
  const recordFocused=focusedPreplan||Boolean(hydrantDraft);
  return <section className={`field-preplans-page${recordFocused?" preplan-builder-focused":""}`}>
    {focusedPreplan&&draft&&<>
      <header className="preplan-focus-header"><button onClick={closePreplan}>&larr; Back to Preplan list</button><div><span>{draft.id?(recordMode==="view"?"VIEW PREPLAN":"EDIT PREPLAN"):"NEW PREPLAN"}</span><h1>{draft.businessName||"Capture building"}</h1><p>{fullAddress(draft)||"A-side GPS location"} &middot; {draft.status}</p></div>{recordMode==="edit"&&current?<button className="record-focus-view-button" onClick={()=>view(current)}>View Preplan</button>:<strong className="record-focus-status">{draft.id?"Saved department record":"Not saved yet"}</strong>}</header>
      {message&&<div className="field-message preplan-focus-message">{message}</div>}
      <div className="preplan-focus-map-panel" ref={focusMapPanel}>
        <div className="field-map-toolbar"><button onClick={locate}>◎ Current location</button><button className={imagery==="aerial"?"active":""} onClick={()=>setImagery("aerial")}>Aerial</button><button className={imagery==="street"?"active":""} onClick={()=>setImagery("street")}>Streets</button><small>Drag to move &middot; wheel or double-click to zoom</small><em className={`map-provider ${mapProvider}`}>{mapProvider==="google"?`Google Maps · ${imagery==="aerial"?"Satellite":"Streets"}`:mapProvider==="loading"?"Loading map…":"Backup map"}</em><span/><button aria-label="Zoom out" onClick={()=>setZoom(Math.max(14,zoom-1))}>−</button><b>Zoom {zoom}</b><button aria-label="Zoom in" onClick={()=>setZoom(Math.min(21,zoom+1))}>+</button></div>
        <FieldMap apiKey={mapsApiKey} center={center} zoom={zoom} imagery={imagery} plans={mapPlans} hydrants={hydrants} selected={selected} draft={draft} mode={operationalMapDraft?`operational-${operationalMapDraft.kind}`:recordMode==="edit"?mode:""} footprintAccepted={footprintAccepted} operationalOverlay={operationalOverlay} operationalDraft={operationalMapDraft} onMapClick={operationalMapDraft||recordMode==="edit"?clickMap:()=>{}} onCenter={setCenter} onZoom={setZoom} onProviderChange={setMapProvider} onHydrantSelect={()=>{}} onSelect={(id)=>{const plan=plans.find((item)=>item.id===id);if(plan&&plan.id!==selected)view(plan);}}/>
      </div>
    </>}
    {!recordFocused&&<>
    <header className="field-preplan-header"><div><p className="eyebrow">Field intelligence</p><h1>Preplans & Hydrants</h1><p>Find a building or water supply record, then open it in a focused workspace.</p></div><div className="field-preplan-actions"><label><span>Search the entire department</span><input type="search" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Business, address, street, or hydrant ID…" aria-label="Search all preplans and hydrants"/></label>{canEdit&&<><button className="primary-action" onClick={beginNewPreplan}>+ New Preplan</button><button className="primary-action hydrant-add" onClick={addHydrant}>+ New Hydrant</button></>}</div></header>
    <nav className="field-directory-tabs" aria-label="Preplan workspaces"><button className={directoryView==="map"?"active":""} onClick={()=>setDirectoryView("map")}><strong>Map & Search</strong><span>{plans.length} preplans · {hydrants.length} hydrants</span></button><button className={directoryView==="starters"?"active":""} onClick={()=>{setMapExpanded(false);setDirectoryView("starters");}}><strong>Build Queue</strong><span>{imports.filter((item)=>item.status!=="completed").length} addresses need work</span></button></nav>
    {message&&<div className="field-message">{message}</div>}
    {directoryView==="map"&&<>
    <div className={`field-map-workspace${mapExpanded?" expanded":""}`}>
      <div className="field-map-toolbar"><button className={locationState==="current"?"active":""} disabled={locationState==="locating"} onClick={locate}>◎ {locationLabel}</button><button className={imagery==="aerial"?"active":""} onClick={()=>setImagery("aerial")}>Aerial</button><button className={imagery==="street"?"active":""} onClick={()=>setImagery("street")}>Streets</button><small>Drag to move · wheel or double-click to zoom</small><em className={`map-provider ${mapProvider}`}>{mapProvider==="google"?`Google Maps · ${imagery==="aerial"?"Satellite":"Streets"}`:mapProvider==="loading"?"Loading map…":"Backup map"}</em><span/><button type="button" className="field-map-expand-button" aria-pressed={mapExpanded} onClick={()=>setMapExpanded((expanded)=>!expanded)}>{mapExpanded?"✕ Exit expanded view":"⛶ Expand map & records"}</button><button aria-label="Zoom out" onClick={()=>setZoom(Math.max(14,zoom-1))}>−</button><b>Zoom {zoom}</b><button aria-label="Zoom in" onClick={()=>setZoom(Math.min(21,zoom+1))}>+</button></div>
      <div className="field-map-layout"><FieldMap apiKey={mapsApiKey} center={center} zoom={zoom} imagery={imagery} plans={mapPlans} hydrants={hydrants} selected={selected} draft={draft} mode={mode} footprintAccepted={footprintAccepted} operationalOverlay={null} operationalDraft={null} onMapClick={clickMap} onCenter={setCenter} onZoom={setZoom} onProviderChange={setMapProvider} onHydrantSelect={openHydrant} onSelect={(id)=>{const plan=plans.find((item)=>item.id===id);if(plan)view(plan);}}/><aside><header><b>{normalizedQuery?"Department search results":"Records in this map view"}</b><span>{shown.length+shownHydrants.length}</span></header>{shown.map((plan)=><button key={plan.id} className={plan.id===selected?"active":""} onClick={()=>view(plan)}><strong>{plan.businessName}</strong><span>{plan.address||"A-side GPS location"}</span><small>{plan.status} · {plan.features.length} mapped items</small><b className="record-open-label">View preplan →</b></button>)}{shownHydrants.map((hydrant)=><button key={hydrant.id} className={hydrant.id===hydrantDraft?.id?"active hydrant-record":"hydrant-record"} onClick={()=>openHydrant(hydrant.id)}><strong><i className={hydrant.serviceStatus}/>{hydrant.hydrantNumber||"Hydrant"}</strong><span>{hydrant.address||`${hydrant.latitude.toFixed(5)}, ${hydrant.longitude.toFixed(5)}`}</span><small>{hydrant.serviceStatus.replaceAll("_"," ")} · {hydrant.flowTests[0]?`${Math.round(hydrant.flowTests[0].availableFlow).toLocaleString()} GPM @ ${hydrant.flowTests[0].desiredResidual} psi`:"Not flow tested"}</small><b className="record-open-label">Open record →</b></button>)}{!shown.length&&!shownHydrants.length&&<p>{normalizedQuery?"No department preplans or hydrants match this search. Try part of a business name, address, street, or hydrant number.":"No records are visible here. Search the department or move the map."}</p>}</aside></div>
    </div>
    </>}
    {directoryView==="starters"&&<section className="imported-building-panel">
      <header>
        <div><span>BUILDING IMPORT</span><h2>Preplan Starters</h2><p>Address matches are automatic; crews verify the location and capture the footprint.</p></div>
        <strong>{imports.filter((item)=>item.status==="completed").length} of {imports.length} completed</strong>
      </header>
      <div className="imported-building-controls">
        <label>Sort<select value={importSort} onChange={(event)=>setImportSort(event.target.value as "street"|"completion")}><option value="street">By street</option><option value="completion">Needs work first</option></select></label>
        {canEdit?<button disabled={busy} onClick={()=>void batchGeocode()}>{busy?"Locating addresses…":"Locate imported addresses"}</button>:null}
        {geocodeProgress?<span role="status">{geocodeProgress}</span>:null}
      </div>
      <div className="imported-street-groups">{groupedImports.map(([street,items])=><details key={street} open={Boolean(normalizedQuery)||undefined}><summary>{street}<span>{items.length}</span></summary>{items.map((item)=><article key={item.id} className={item.status==="completed"?"completed":item.status==="geocode_failed"?"needs-review":""}><div><strong>{item.businessName}</strong><span>{item.address}</span><small>{item.status==="completed"?"Preplan completed":item.status==="geocoded"?"Address located · footprint required":item.status==="geocode_failed"?"Address needs manual review":"Waiting for address lookup"}</small></div>{canEdit?<button onClick={()=>startImportedBuilding(item)}>{item.status==="completed"?"Open Preplan":item.status==="geocoded"?"Verify & Build":"Locate & Build"}</button>:<span>{item.status==="completed"?"Completed":"Awaiting field capture"}</span>}</article>)}</details>)}</div>
      {!shownImports.length&&<p>No imported buildings match this search.</p>}
    </section>}
    </>}
    {hydrantDraft&&<>
      <header className="preplan-focus-header"><button onClick={closeHydrant}>&larr; All Preplans & Hydrants</button><div><span>WATER SUPPLY RECORD</span><h1>{hydrantDraft.hydrantNumber||"New hydrant"}</h1><p>{hydrantDraft.address||`${hydrantDraft.latitude.toFixed(6)}, ${hydrantDraft.longitude.toFixed(6)}`}</p></div><strong className={`record-focus-status ${hydrantDraft.serviceStatus}`}>{hydrantDraft.id?hydrantDraft.serviceStatus.replaceAll("_"," "):"Not saved yet"}</strong></header>
      {message&&<div className="field-message preplan-focus-message">{message}</div>}
      <div className="preplan-focus-map-panel"><div className="field-map-toolbar"><button onClick={locate}>◎ Current location</button><button className={imagery==="aerial"?"active":""} onClick={()=>setImagery("aerial")}>Aerial</button><button className={imagery==="street"?"active":""} onClick={()=>setImagery("street")}>Streets</button><span/><button aria-label="Zoom out" onClick={()=>setZoom(Math.max(14,zoom-1))}>−</button><b>Zoom {zoom}</b><button aria-label="Zoom in" onClick={()=>setZoom(Math.min(21,zoom+1))}>+</button></div><FieldMap apiKey={mapsApiKey} center={center} zoom={zoom} imagery={imagery} plans={[]} hydrants={hydrantDraft.id?[hydrantDraft]:[]} selected="" draft={null} mode="" footprintAccepted operationalOverlay={null} operationalDraft={null} onMapClick={()=>{}} onCenter={setCenter} onZoom={setZoom} onProviderChange={setMapProvider} onHydrantSelect={()=>{}} onSelect={()=>{}}/></div>
    </>}
    {hydrantDraft&&<section className="hydrant-editor">
      <header><div><span>WATER SUPPLY</span><h2>{hydrantDraft.hydrantNumber||"Quick Add Hydrant"}</h2><p>{hydrantDraft.address||`${hydrantDraft.latitude.toFixed(6)}, ${hydrantDraft.longitude.toFixed(6)}`}</p></div><nav><button className={hydrantTab==="quick"?"active":""} onClick={()=>setHydrantTab("quick")}>Quick Add</button><button disabled={!hydrantDraft.id} className={hydrantTab==="details"?"active":""} onClick={()=>setHydrantTab("details")}>Hydrant Details</button><button disabled={!hydrantDraft.id} className={hydrantTab==="flush"?"active":""} onClick={()=>setHydrantTab("flush")}>Flushing</button><button disabled={!hydrantDraft.id} className={hydrantTab==="flow"?"active":""} onClick={()=>setHydrantTab("flow")}>NFPA 291 Flow Test</button></nav></header>
      {hydrantTab==="quick"&&<div className="hydrant-quick"><article><HydrantIcon outOfService={hydrantDraft.serviceStatus==="out_of_service"}/><div><strong>GPS location captured</strong><span>{hydrantDraft.latitude.toFixed(6)}, {hydrantDraft.longitude.toFixed(6)}</span><button onClick={addHydrant}>Refresh current location</button></div></article><label>Hydrant ID number<input value={hydrantDraft.hydrantNumber} onChange={(event)=>setHydrantDraft({...hydrantDraft,hydrantNumber:event.target.value})}/></label><label>Nearest address, if available<input value={hydrantDraft.address} onChange={(event)=>setHydrantDraft({...hydrantDraft,address:event.target.value})}/></label><label>Service status<select value={hydrantDraft.serviceStatus} onChange={(event)=>setHydrantDraft({...hydrantDraft,serviceStatus:event.target.value})}><option value="in_service">In service</option><option value="out_of_service">Out of service</option></select></label><button className="primary-action hydrant-add" disabled={busy} onClick={()=>void saveHydrant()}>Save Quick Hydrant</button></div>}
      {hydrantTab==="details"&&<div className="hydrant-details"><article className="content-card hydrant-profile"><h3>Hydrant profile</h3><label>Hydrant ID<input value={hydrantDraft.hydrantNumber} onChange={(event)=>setHydrantDraft({...hydrantDraft,hydrantNumber:event.target.value})}/></label><label>Address<input value={hydrantDraft.address} onChange={(event)=>setHydrantDraft({...hydrantDraft,address:event.target.value})}/></label><label>Manufacturer<input value={hydrantDraft.manufacturer} onChange={(event)=>setHydrantDraft({...hydrantDraft,manufacturer:event.target.value})}/></label><label>Model<input value={hydrantDraft.model} onChange={(event)=>setHydrantDraft({...hydrantDraft,model:event.target.value})}/></label><label>Port layout<select value={hydrantDraft.portCount} onChange={(event)=>{const count=Number(event.target.value);setHydrantDraft({...hydrantDraft,portCount:count,portSizes:Array.from({length:count},(_,index)=>hydrantDraft.portSizes[index]||"2.5")});}}><option value="1">1 port</option><option value="2">2 ports</option><option value="3">3 ports</option></select></label><div className="hydrant-ports">{Array.from({length:hydrantDraft.portCount},(_,index)=><label key={index}>Port {index+1} size (in.)<input inputMode="decimal" value={hydrantDraft.portSizes[index]||""} onChange={(event)=>{const sizes=[...hydrantDraft.portSizes];sizes[index]=event.target.value;setHydrantDraft({...hydrantDraft,portSizes:sizes});}}/></label>)}</div><label>Operational notes<textarea value={hydrantDraft.notes} onChange={(event)=>setHydrantDraft({...hydrantDraft,notes:event.target.value})}/></label><label>Service status<select value={hydrantDraft.serviceStatus} onChange={(event)=>setHydrantDraft({...hydrantDraft,serviceStatus:event.target.value})}><option value="in_service">In service</option><option value="out_of_service">Out of service</option></select></label><button className="primary-action" disabled={busy} onClick={()=>void saveHydrant()}>Save Hydrant Details</button></article><article className="content-card hydrant-summary"><HydrantIcon outOfService={hydrantDraft.serviceStatus==="out_of_service"}/><h3>{hydrantDraft.hydrantNumber||"Hydrant"}</h3><strong>{hydrantDraft.serviceStatus.replaceAll("_"," ")}</strong><dl><div><dt>Make</dt><dd>{hydrantDraft.manufacturer||"Not entered"}</dd></div><div><dt>Model</dt><dd>{hydrantDraft.model||"Not entered"}</dd></div><div><dt>Ports</dt><dd>{hydrantDraft.portSizes.join('" · ')||"Not entered"}{hydrantDraft.portSizes.length?'"':""}</dd></div><div><dt>Last flushed</dt><dd>{selectedHydrant?.flushes[0]?new Date(selectedHydrant.flushes[0].flushedAt).toLocaleDateString():"No record"}</dd></div></dl></article></div>}
      {hydrantTab==="flush"&&selectedHydrant&&<div className="hydrant-maintenance"><article className="content-card"><h3>Add flushing record</h3><label>Date and time<input type="datetime-local" value={flush.flushedAt} onChange={(event)=>setFlush({...flush,flushedAt:event.target.value})}/></label><label className="check-row"><input type="checkbox" checked={flush.waterClear} onChange={(event)=>setFlush({...flush,waterClear:event.target.checked})}/>Water ran clear</label><label>Issues found<textarea value={flush.issues} onChange={(event)=>setFlush({...flush,issues:event.target.value})}/></label><label>Notes<textarea value={flush.notes} onChange={(event)=>setFlush({...flush,notes:event.target.value})}/></label><button className="primary-action" disabled={busy} onClick={()=>void saveHydrantAction({action:"addFlush",hydrantId:selectedHydrant.id,...flush},"Flushing record saved")}>Save Flushing Record</button></article><article className="content-card"><h3>Flushing history</h3>{selectedHydrant.flushes.length?selectedHydrant.flushes.map((item)=><div className="hydrant-history" key={item.id}><strong>{new Date(item.flushedAt).toLocaleString()}</strong><span>{item.waterClear?"Water clear":"Water not marked clear"} · {item.flushedBy}</span><p>{item.issues||item.notes||"No issues recorded"}</p></div>):<p>No flushing records yet.</p>}</article></div>}
      {hydrantTab==="flow"&&selectedHydrant&&<div className="hydrant-flow-workspace"><article className="content-card flow-guide"><h3>NFPA 291 guided flow test</h3><ol><li><b>Static / residual hydrant:</b> {selectedHydrant.hydrantNumber||"this hydrant"}. Record static pressure with flow hydrants closed, then residual pressure while water is flowing.</li><li><b>Flow hydrant:</b> select a different hydrant. Record outlet diameter and pitot pressure at the center of the stream.</li><li><b>Coefficient:</b> choose the outlet shape. The site calculates measured discharge and projected available flow.</li></ol><div className="flow-form"><label>Test date and time<input type="datetime-local" value={flow.testedAt} onChange={(event)=>setFlow({...flow,testedAt:event.target.value})}/></label><label>Flow hydrant<select value={flow.flowHydrantId} onChange={(event)=>setFlow({...flow,flowHydrantId:event.target.value})}><option value="">Choose different hydrant…</option>{hydrants.filter((item)=>item.id!==selectedHydrant.id).map((item)=><option value={item.id} key={item.id}>{item.hydrantNumber||item.address||item.id}</option>)}</select></label><label>Static pressure (psi)<input inputMode="decimal" value={flow.staticPressure} onChange={(event)=>setFlow({...flow,staticPressure:event.target.value})}/></label><label>Residual pressure while flowing (psi)<input inputMode="decimal" value={flow.residualPressure} onChange={(event)=>setFlow({...flow,residualPressure:event.target.value})}/></label><label>Desired residual (psi)<input inputMode="decimal" value={flow.desiredResidual} onChange={(event)=>setFlow({...flow,desiredResidual:event.target.value})}/><small>20 psi is the common NFPA 291 marking basis; follow the AHJ.</small></label><label>Flow outlet diameter (in.)<input inputMode="decimal" value={flow.outletDiameter} onChange={(event)=>setFlow({...flow,outletDiameter:event.target.value})}/></label><label>Pitot pressure (psi)<input inputMode="decimal" value={flow.pitotPressure} onChange={(event)=>setFlow({...flow,pitotPressure:event.target.value})}/></label><label>Outlet coefficient<select value={flow.dischargeCoefficient} onChange={(event)=>setFlow({...flow,dischargeCoefficient:event.target.value})}><option value=".9">0.90 · smooth / rounded outlet</option><option value=".8">0.80 · square / sharp outlet</option><option value=".7">0.70 · projecting outlet</option></select></label><label className="wide">Test notes<textarea value={flow.notes} onChange={(event)=>setFlow({...flow,notes:event.target.value})}/></label></div><button className="primary-action" disabled={busy||!availablePreview} onClick={()=>void saveHydrantAction({action:"addFlowTest",testHydrantId:selectedHydrant.id,...flow},"Flow test saved")}>Save Flow Test</button></article><aside className={`flow-result ${flowClass.color}`}><span>CALCULATED</span><strong>{Math.round(measuredPreview).toLocaleString()}</strong><small>GPM measured from flow outlet</small><strong>{Math.round(availablePreview).toLocaleString()}</strong><small>GPM available at {flow.desiredResidual||20} psi</small><b>Class {flowClass.code} · {flowClass.label}</b><p>Q = 29.83 × C × d² × √p</p><p>Available = Q × ((Static − Desired) ÷ (Static − Residual))<sup>0.54</sup></p></aside><article className="content-card flow-history"><h3>Previous tests</h3>{selectedHydrant.flowTests.length?selectedHydrant.flowTests.map((item)=><div key={item.id}><strong>{Math.round(item.availableFlow).toLocaleString()} GPM @ {item.desiredResidual} psi</strong><span>{new Date(item.testedAt).toLocaleDateString()} · Flow hydrant {item.flowHydrantNumber||"recorded"}</span><small>Static {item.staticPressure} · Residual {item.residualPressure} · Pitot {item.pitotPressure} psi · {item.outletDiameter}&quot; · C {item.dischargeCoefficient}</small></div>):<p>No flow tests recorded.</p>}</article></div>}
      {canEdit&&hydrantDraft.id&&<DeleteRecordControl kind="hydrant" name={hydrantDraft.hydrantNumber||hydrantDraft.address||"this hydrant"} busy={busy} onConfirm={()=>deleteHydrant(hydrantDraft.id)}/>}
    </section>}
    {current&&recordMode==="view"&&<PreplanRecordView plan={current} canEdit={canEdit} onEdit={()=>edit(current)} onShowFeature={(item)=>{setCenter({lat:item.latitude,lng:item.longitude});setZoom(20);focusMapPanel.current?.scrollIntoView({behavior:"smooth",block:"start"});}}/>}
    {draft&&recordMode==="edit"&&<section className="preplan-editor">
      <header><div><span>{draft.id?"EDIT PREPLAN":"NEW PREPLAN"}</span><h2>{draft.businessName||"Capture building"}</h2></div><nav aria-label="Preplan sections"><button className={tab==="quick"?"active":""} onClick={()=>setTab("quick")}>1. Quick Preplan</button><button disabled={!draft.id} className={tab==="details"?"active":""} onClick={()=>setTab("details")}>2. Building Systems</button><button disabled={!draft.id} className={tab==="photos"?"active":""} onClick={()=>setTab("photos")}>3. A–D Photos</button><button disabled={!draft.id} className={tab==="operational"?"active":""} onClick={()=>setTab("operational")}>4. Operational Intelligence</button></nav></header>
      {tab==="quick"&&<><nav className="preplan-step-tabs" aria-label="Quick preplan steps"><button className={quickStep===1?"active":""} onClick={()=>setQuickStep(1)}><b>1</b><span>Footprint</span></button><button className={quickStep===2?"active":""} onClick={()=>setQuickStep(2)}><b>2</b><span>Building</span></button><button className={quickStep===3?"active":""} onClick={()=>setQuickStep(3)}><b>3</b><span>Systems & Save</span></button></nav><div className="preplan-quick-grid preplan-single-step">
        {quickStep===1&&<article><h3>Capture the overhead footprint</h3><p>Place one point on each outside corner in order around the building, then accept the closed outline.</p><div className="capture-buttons"><button className={mode==="footprint"?"active":""} onClick={()=>{setMode("footprint");setFootprintAccepted(false);focusMapPanel.current?.scrollIntoView({behavior:"smooth",block:"start"});}}>Place corner points on map</button><button onClick={()=>{setDraft({...draft,footprint:draft.footprint.slice(0,-1)});setFootprintAccepted(false);}}>Undo last point</button><button onClick={()=>{setDraft({...draft,footprint:[],footprintSquareFeet:0,fireFlowCalculationArea:0,suggestedFireFlowGpm:0,suggestedFireFlowDuration:0});setFootprintAccepted(false);setMode("footprint");}}>Clear footprint</button>{draft.footprint.length>=3&&!footprintAccepted&&<button className="accept-footprint" onClick={()=>{const centroid=footprintCentroid(draft.footprint);setDraft({...draft,...(centroid&&draft.aSideLatitude==null?{latitude:centroid.lat,longitude:centroid.lng}:{}),footprintSquareFeet,fireFlowCalculationArea:fireFlowPreview?.calculationArea??0,suggestedFireFlowGpm:fireFlowPreview?.suggestedGpm??0,suggestedFireFlowDuration:fireFlowPreview?.durationHours??0});setFootprintAccepted(true);setMode("");}}>✓ Accept Footprint</button>}</div><div className="footprint-metrics"><span><b>{draft.footprint.length}</b> corner points</span><span><b>{footprintSquareFeet.toLocaleString()}</b> sq ft ground footprint</span></div>{footprintAccepted&&<strong className="footprint-accepted">✓ Footprint accepted, highlighted and measured</strong>}<button className={mode==="aSide"?"active wide-action": "wide-action"} onClick={()=>{setMode("aSide");focusMapPanel.current?.scrollIntoView({behavior:"smooth",block:"start"});}}>Set private A-side / fallback GPS point</button><p className="privacy-note">The A-side point is stored for routing fallback and is not rendered as a public map pin.</p><button className="preplan-next-button" disabled={!footprintAccepted} onClick={()=>setQuickStep(2)}>Next: Building information →</button></article>}
        {quickStep===2&&<article className="preplan-form"><h3>Building information</h3><label>Business / building name<input value={draft.businessName} onChange={(event)=>setDraft({...draft,businessName:event.target.value})}/></label><fieldset className="preplan-address-fields"><legend>Building address</legend><label>Street address<input value={draft.street} onChange={(event)=>setDraft({...draft,street:event.target.value})} placeholder="Street number and name"/></label><label>City<input value={draft.city} onChange={(event)=>setDraft({...draft,city:event.target.value})}/></label><label>State<input value={draft.state} onChange={(event)=>setDraft({...draft,state:event.target.value})}/></label><label>ZIP code<input inputMode="numeric" value={draft.zipCode} onChange={(event)=>setDraft({...draft,zipCode:event.target.value})} maxLength={10}/></label></fieldset><PreplanContactsEditor contacts={draft.contacts} onChange={(contacts)=>setDraft({...draft,contacts})}/><label>Construction notes<input value={draft.construction} onChange={(event)=>setDraft({...draft,construction:event.target.value})} placeholder="Roof, occupancy and special construction details"/></label><div className="fire-flow-inputs"><label>Construction type<select value={draft.constructionType} onChange={(event)=>setDraft({...draft,constructionType:event.target.value as ConstructionGroup})}>{constructionOptions.map((item)=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Number of floor levels<input type="number" min="1" max="99" value={draft.floorCount} onChange={(event)=>setDraft({...draft,floorCount:Math.max(1,Number(event.target.value)||1)})}/></label><label>IFC occupancy path<select value={draft.occupancyFlowCategory} onChange={(event)=>{const occupancy=event.target.value as OccupancyFlowCategory;setDraft({...draft,occupancyFlowCategory:occupancy,sprinklerStandard:draft.sprinklerStandard==="none"?"none":occupancy==="dwelling"?"residential":"nfpa13"});}}><option value="other">Other than R-3/R-4 dwelling</option><option value="dwelling">1–2 family, R-3/R-4 or townhouse</option></select></label><label>Automatic sprinkler system<select value={draft.sprinklerStandard==="none"?"no":"yes"} onChange={(event)=>setDraft({...draft,sprinklerStandard:event.target.value==="yes"?(draft.occupancyFlowCategory==="dwelling"?"residential":"nfpa13"):"none"})}><option value="no">No</option><option value="yes">Yes</option></select></label></div><label>Access concerns / information<textarea value={draft.accessInfo} onChange={(event)=>setDraft({...draft,accessInfo:event.target.value})}/></label><div className="preplan-step-actions"><button onClick={()=>setQuickStep(1)}>← Footprint</button><button className="preplan-next-button" onClick={()=>setQuickStep(3)}>Next: Systems & save →</button></div></article>}
        {quickStep===3&&<article className="preplan-form systems"><h3>Quick building systems</h3><p className="quick-system-help">Choose the closest known condition. Use Building Systems afterward to map exact equipment locations and photos.</p>{quickSystemFields.map(({key,label,options})=>{const existing=draft[key]&&!options.some((option)=>option===draft[key])?draft[key]:"";return <label key={key}>{label}<select value={draft[key]} onChange={(event)=>setDraft({...draft,[key]:event.target.value})}><option value="">Not entered</option>{existing&&<option value={existing}>Existing: {existing}</option>}{options.map((option)=><option key={option} value={option}>{option}</option>)}</select></label>;})}<section className="fire-flow-preview"><span>IFC 2018 APPENDIX B · ADVISORY</span><div><strong>{fireFlowPreview?`${fireFlowPreview.suggestedGpm.toLocaleString()} GPM`:"Complete footprint"}</strong><b>{fireFlowPreview?`${fireFlowPreview.durationHours} hr duration`:"to calculate"}</b></div><small>{fireFlowPreview?`${fireFlowPreview.calculationArea.toLocaleString()} sq ft fire-flow calculation area · ${fireFlowPreview.reduction}`:"The estimate needs an accepted footprint, floor count, construction type and sprinkler assumption."}</small><p>Planning suggestion only. Confirm the adopted code edition and local amendments.</p></section><div className="preplan-step-actions"><button onClick={()=>setQuickStep(2)}>← Building</button><button className="primary-action" disabled={busy||draft.footprint.length<3||!footprintAccepted} onClick={()=>void savePlan()}>{busy?"Saving…":draft.id?"Save Quick Preplan":"Create Preplan"}</button></div></article>}
      </div></>}
      {tab==="details"&&current&&<><nav className="preplan-subtabs" aria-label="Building system tasks"><button className={detailsStep==="overview"?"active":""} onClick={()=>setDetailsStep("overview")}><b>1</b> Building overview</button><button className={detailsStep==="add"?"active":""} onClick={()=>setDetailsStep("add")}><b>2</b> Add a feature</button><button className={detailsStep==="systems"?"active":""} onClick={()=>setDetailsStep("systems")}><b>3</b> Mapped systems <span>{current.features.length}</span></button></nav><div className="preplan-detail-grid preplan-single-detail">
        {detailsStep==="overview"&&<article className="content-card building-intelligence-card"><header><div><span>DETAILED FLOOR PLAN</span><h3>Building size & suggested fire flow</h3></div><b>IFC 2018 Appendix B · Advisory</b></header><div className="building-intelligence-metrics"><div><span>Ground footprint</span><strong>{Math.round(current.footprintSquareFeet||polygonAreaSquareFeet(current.footprint)).toLocaleString()} sq ft</strong><small>{current.footprint.length} mapped corner points</small></div><div><span>Floor levels</span><strong>{current.floorCount||1}</strong><small>{(current.constructionType==="I"||current.constructionType==="IA_IB")&&current.floorCount>3?"Three largest successive floors used":constructionOptions.find((item)=>item.value===simpleConstruction(current.constructionType))?.label||"Construction not classified"}</small></div><div><span>Calculation area</span><strong>{Math.round(current.fireFlowCalculationArea||0).toLocaleString()} sq ft</strong><small>Total floor area used for the advisory lookup</small></div><div className="recommended"><span>Suggested fire flow</span><strong>{current.suggestedFireFlowGpm?`${current.suggestedFireFlowGpm.toLocaleString()} GPM`:"Needs review"}</strong><small>{current.suggestedFireFlowDuration?`${current.suggestedFireFlowDuration} hour duration`:"No duration calculated"}</small></div></div><p>This is a planning aid, not an approved fire-flow determination. Confirm the adopted code edition, AHJ amendments, fire-area separations and the greater of sprinkler demand plus hose allowance or required fire flow.</p><button className="preplan-next-button" onClick={()=>setDetailsStep("add")}>Next: Add an operational feature →</button></article>}
        {detailsStep==="add"&&<article className="content-card">
          <h3>Place an operational feature</h3>
          <label>Feature<select value={feature.featureType} onChange={(event)=>setFeature({...feature,featureType:event.target.value})}>{pinTypes.map(([key,,label])=><option key={key} value={key}>{label}</option>)}</select></label>
          <label>Label<input value={feature.label} onChange={(event)=>setFeature({...feature,label:event.target.value})} placeholder="Example: Alpha/Bravo corner"/></label>
          <label>System type<select value={feature.systemType} onChange={(event)=>setFeature({...feature,systemType:event.target.value})}>{systemOptions.map((item)=><option key={item}>{item||"Choose type"}</option>)}</select></label>
          <label>Status<select value={feature.serviceStatus} onChange={(event)=>setFeature({...feature,serviceStatus:event.target.value})}><option value="in_service">In service</option><option value="out_of_service">Out of service</option><option value="unknown">Unknown</option></select></label>
          <label>Details<textarea value={feature.details} onChange={(event)=>setFeature({...feature,details:event.target.value})} placeholder="Monitoring company, keys, valves, access, hazards…"/></label>
          <div className="feature-photo-capture">
            <span>Feature photo (optional)</span>
            <label className="feature-photo-button">{featurePhoto?"Replace photo":"Take or choose photo"}<input ref={featurePhotoInput} type="file" accept="image/*" capture="environment" disabled={busy} onChange={(event)=>setFeaturePhoto(event.target.files?.[0]??null)}/></label>
            {featurePhoto?<div className="feature-photo-ready"><strong>Photo ready</strong><span>{featurePhoto.name}</span><button type="button" onClick={()=>{setFeaturePhoto(null);if(featurePhotoInput.current)featurePhotoInput.current.value="";}}>Remove</button></div>:<small>On a phone or iPad, this opens the camera. The photo saves when you place the feature on the map.</small>}
          </div>
          <div className="feature-placement-actions">
            <button type="button" className="primary-action" disabled={busy||featureLocating} onClick={()=>{setMode(feature.featureType);focusMapPanel.current?.scrollIntoView({behavior:"smooth",block:"start"});}}>Use map to place {pinMeta[feature.featureType]?.label}</button>
            <button type="button" className="feature-gps-action" disabled={busy||featureLocating} onClick={placeFeatureAtCurrentLocation}>{featureLocating?"Finding current location…":`Use current GPS location`}</button>
          </div>
          <small>Use GPS while standing beside the feature, or choose its exact position on the map. The optional photo is saved with either method.</small>
          <small>Feature symbols appear only on this selected building. Zooming out leaves the highlighted footprint.</small>
        </article>}
        {detailsStep==="systems"&&<article className="content-card mapped-feature-list">
          <header className="mapped-feature-list-header"><div><h3>Mapped building systems</h3><p>Review each feature below. You can locate it on the map, add a camera photo, or add another feature.</p></div><b>{current.features.length}</b></header>
          {current.features.length?<div className="mapped-feature-records">{current.features.map((item)=>{const photos=current.photos.filter((photo)=>photo.featureId===item.id),name=item.label||pinMeta[item.featureType]?.label||"Feature";return <section key={item.id} className="mapped-feature-record"><div className="mapped-feature-summary"><span className={`feature-symbol ${item.featureType}`}>{pinMeta[item.featureType]?.short||"•"}</span><div><strong>{name}</strong><span>{item.systemType||"Type not entered"}</span><small className={`feature-service-status ${item.serviceStatus}`}>{item.serviceStatus.replaceAll("_"," ")}</small></div></div><div className="mapped-feature-details"><span>Details</span><p>{item.details||"No additional details entered."}</p></div>{photos[0]?<div className="mapped-feature-photo"><img src={photos[0].url} alt={photos[0].caption||`${name} feature`}/><span>{photos.length} photo{photos.length===1?"":"s"}</span></div>:<div className="mapped-feature-no-photo"><span>No photo yet</span><small>Use the button below to take one.</small></div>}<div className="mapped-feature-actions"><button type="button" className="mapped-feature-map-button" onClick={()=>{setCenter({lat:item.latitude,lng:item.longitude});setZoom(20);focusMapPanel.current?.scrollIntoView({behavior:"smooth",block:"start"});}}>Show on map</button><label className="mapped-feature-photo-button">{photos.length?"Add another photo":"Take or add photo"}<input type="file" accept="image/*" capture="environment" disabled={busy} onChange={(event)=>void uploadFeaturePhoto(event,item)}/></label>{canDeletePreplan&&<DeleteFeatureControl name={name} busy={busy} onConfirm={()=>deleteFeature(item)}/>}</div></section>})}</div>:<div className="mapped-feature-empty"><strong>No mapped systems yet</strong><span>Add the Knox Box, FDC, riser, alarm panel, shutoffs, and other operational features crews need to find.</span></div>}
          <button type="button" className="mapped-feature-add-button" onClick={()=>setDetailsStep("add")}>+ Add another operational feature</button>
        </article>}
      </div></>}
      {tab==="photos"&&current&&<><nav className="preplan-photo-tabs" aria-label="Building side photos">{(["A","B","C","D"] as const).map((side)=><button key={side} className={photoSide===side?"active":""} onClick={()=>setPhotoSide(side)}><b>{side}</b><span>{current.photos.filter((photo)=>photo.side===side).length} photo{current.photos.filter((photo)=>photo.side===side).length===1?"":"s"}</span></button>)}</nav><div className="preplan-photo-grid preplan-single-photo">{([photoSide] as const).map((side)=>{const photos=current.photos.filter((photo)=>photo.side===side);return <article key={side}><header><div><b>{side} Side</b><span>Document the full exterior side and critical access points.</span></div><label>{busy?"Uploading…":"Take or add photo"}<input type="file" accept="image/*" capture="environment" disabled={busy} onChange={(event)=>void upload(event,side)}/></label></header>{photos.length?<div>{photos.map((photo)=><img src={photo.url} alt={`${side} side ${photo.caption||photo.filename}`} key={photo.id}/>)}</div>:<p>No {side}-side photos yet. Use a phone or iPad camera, or choose an existing image.</p>}<small>Visual symbols may be documented in the photo caption without creating map pins.</small></article>;})}</div></>}
      {tab==="operational"&&current&&<div className="preplan-operational-edit"><OperationalPreplanPanel preplanId={current.id} canEdit={canEdit} mapDraft={operationalMapDraft} onMapOverlayChange={handleOperationalOverlay} onMapDrawingStart={startOperationalDrawing} onMapDrawingChange={changeOperationalDrawing}/></div>}
      {canDeletePreplan&&draft.id&&<DeleteRecordControl kind="preplan" name={draft.businessName||draft.address||"this preplan"} busy={busy} onConfirm={()=>deletePreplan(draft.id)}/>}
    </section>}
  </section>;
}
