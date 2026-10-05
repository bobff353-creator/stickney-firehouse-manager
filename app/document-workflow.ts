export const controlledDocumentTypes = ['SOG','SOP','Policy','Form','Manual','Bulletin','Other'] as const;
export type DocumentContent = {title:string;policyNumber:string;category:string;effectiveDate:string;body:string;documentType:string;sourceUrl:string};
export type DocumentState = {revision:string;draft:DocumentContent|null;publishedVersion:string;publishedType?:string;publishedReference?:string;archived:boolean;lastOperation?:{action:string;revision:string}};
export type DocumentVersion = {id:string;number:number;legacy:boolean;content:DocumentContent;publishedAt:string;publishedBy:string;requiresAcknowledgement:boolean;recipients:Array<{id:string;name:string}>};
export type DocumentAcknowledgement = {version:string;employeeId:string;acknowledgedAt:string;actor:string};
export const emptyDocumentState = ():DocumentState=>({revision:'',draft:null,publishedVersion:'',archived:false});
export function validDocumentDate(value:string) {
  const d=new Date(value+'T12:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}
export function normalizeDocument(input:unknown):DocumentContent {
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Enter the document details.');
  const raw=input as Record<string,unknown>,text=(key:string,maximum:number,fallback='')=>{const value=String(raw[key]??fallback).trim();if(value.length>maximum)throw Error('The document is too large. Preserve the original and shorten this draft.');return value;};
  const data={title:text('title',240),policyNumber:text('policyNumber',80),category:text('category',160,'General'),effectiveDate:text('effectiveDate',10),body:text('body',45000),documentType:text('documentType',20,'Policy'),sourceUrl:text('sourceUrl',2000)};
  if(!data.title)throw Error('A document title is required.');
  if(new TextEncoder().encode(data.body).length>45000)throw Error('The document text is too large. Preserve the original and use a document reference.');
  if(data.effectiveDate&&!validDocumentDate(data.effectiveDate))throw Error('Enter a valid effective date.');
  if(!controlledDocumentTypes.some(type=>type===data.documentType))throw Error('Choose a listed document type.');
  if(data.sourceUrl){try{const url=new URL(data.sourceUrl);if(url.protocol!=='https:'||url.username||url.password)throw Error();}catch{throw Error('Document references must use https without embedded credentials.');}}
  return data;
}
