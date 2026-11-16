/** Portable, dependency-free backup envelope. No application or runtime secrets. */
export const BACKUP_FORMAT='stickney-firehouse-native-inspection-backup/v1';
export const MAX_BACKUP_ENTRIES=20_000;
export const MAX_MANIFEST_BYTES=3*1024*1024;
export const MAX_BACKUP_PART_BYTES=32*1024*1024;
export const MAX_BACKUP_IMAGE_BYTES=12*1024*1024;
export const MAX_METADATA_PART_BYTES=8*1024*1024;
export type BackupEntry={path:string;kind:'dataset'|'photo'|'document'|'unindexed';dataset?:string;size:number;sha256:string;crc32:number;sourceKey?:string;photoId?:string;inspectionId?:string;contentType?:string;originalContentType?:string};
export type BackupManifest={format:typeof BACKUP_FORMAT;backupId:string;createdAt:string;snapshotAt:string;sourceScopeHash:string;datasets:{name:string;rows:number;restore:'missing-only'|'archive-only'}[];entries:BackupEntry[];notes:string[]};
export const backupObject=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const table=Array.from({length:256},(_,index)=>{let value=index;for(let bit=0;bit<8;bit++)value=(value&1)?0xedb88320^(value>>>1):value>>>1;return value>>>0;});
export function backupCrc32(bytes:Uint8Array){let value=0xffffffff;for(const byte of bytes)value=table[(value^byte)&255]^(value>>>8);return(value^0xffffffff)>>>0;}
export async function backupDigest(bytes:Uint8Array){const hash=await crypto.subtle.digest('SHA-256',bytes as BufferSource);return [...new Uint8Array(hash)].map(byte=>byte.toString(16).padStart(2,'0')).join('');}
export function backupImageType(bytes:Uint8Array){
  if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((byte,index)=>bytes[index]===byte))return 'image/png';
  if(bytes.length>=12&&new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')return 'image/webp';
  return '';
}
export function backupPath(path:unknown):path is string{return typeof path==='string'&&path.length<=240&&!path.includes('..')&&/^(?:metadata\/[a-z_]+\/[0-9]{8}\.json|evidence\/[A-Za-z0-9_.:-]+\.(?:jpg|png|webp)|documents\/[A-Za-z0-9_.:-]+\.pdf|unindexed\/[a-f0-9]{64}\.(?:jpg|png|webp|pdf|bin))$/.test(path);}
export function validateBackupManifest(value:unknown):asserts value is BackupManifest{
  if(!backupObject(value)||value.format!==BACKUP_FORMAT||typeof value.backupId!=='string'||!/^[A-Za-z0-9_.:-]{1,128}$/.test(value.backupId)||typeof value.sourceScopeHash!=='string'||!/^[a-f0-9]{64}$/.test(value.sourceScopeHash)||typeof value.createdAt!=='string'||!Number.isFinite(Date.parse(value.createdAt))||typeof value.snapshotAt!=='string'||!Number.isFinite(Date.parse(value.snapshotAt)))throw Error('This is not a supported native Stickney inspection backup.');
  if(!Array.isArray(value.entries)||value.entries.length>MAX_BACKUP_ENTRIES||!Array.isArray(value.datasets)||value.datasets.length>40||!Array.isArray(value.notes)||value.notes.some(note=>typeof note!=='string'))throw Error('The backup manifest has invalid entry counts.');
  const datasets=new Set<string>();for(const entry of value.datasets){if(!backupObject(entry)||typeof entry.name!=='string'||!/^[a-z_]+$/.test(entry.name)||datasets.has(entry.name)||!Number.isSafeInteger(entry.rows)||Number(entry.rows)<0||!['missing-only','archive-only'].includes(String(entry.restore)))throw Error('The backup dataset list is invalid.');datasets.add(entry.name);}
  const paths=new Set<string>();let bytes=0;
  for(const entry of value.entries){
    if(!backupObject(entry)||!backupPath(entry.path)||paths.has(entry.path)||!['dataset','photo','document','unindexed'].includes(String(entry.kind))||!Number.isSafeInteger(entry.size)||Number(entry.size)<1||Number(entry.size)>MAX_BACKUP_PART_BYTES||typeof entry.sha256!=='string'||!/^[a-f0-9]{64}$/.test(entry.sha256)||!Number.isInteger(entry.crc32)||Number(entry.crc32)<0||Number(entry.crc32)>0xffffffff)throw Error('The backup contains an invalid, duplicate or oversized file entry.');
    if(entry.kind==='dataset'&&(typeof entry.dataset!=='string'||!datasets.has(entry.dataset)||!entry.path.startsWith('metadata/'+entry.dataset+'/')||Number(entry.size)>MAX_METADATA_PART_BYTES))throw Error('A backup metadata file does not match its dataset.');
    if(entry.kind!=='dataset'&&(!['image/jpeg','image/png','image/webp','application/pdf','application/octet-stream'].includes(String(entry.contentType))||typeof entry.sourceKey!=='string'||entry.sourceKey.length>1024))throw Error('A backup evidence file has invalid metadata.');
    if(entry.kind==='photo'&&(typeof entry.photoId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(entry.photoId)||typeof entry.inspectionId!=='string'))throw Error('A backup photo is missing its identity.');
    if(entry.kind==='photo'&&(!String(entry.contentType).startsWith('image/')||Number(entry.size)>MAX_BACKUP_IMAGE_BYTES))throw Error('A photo exceeds its supported evidence bounds.');
    if(entry.kind==='document'&&(entry.contentType!=='application/pdf'||typeof entry.inspectionId!=='string'||!entry.path.startsWith('documents/')))throw Error('An official document has invalid identity or type.');
    paths.add(entry.path);bytes+=Number(entry.size);if(!Number.isSafeInteger(bytes))throw Error('The backup size cannot be represented safely.');
  }
}

type ZipFile={path:string;size:number;crc32:number;body:()=>Promise<ReadableStream<Uint8Array>|Uint8Array>};
const encoder=new TextEncoder();
function bytes(length:number){return new Uint8Array(length);}
function view(value:Uint8Array){return new DataView(value.buffer,value.byteOffset,value.byteLength);}
/** Stored ZIP/ZIP64 streams one R2 file at a time and respects backpressure. */
export function backupZipStream(files:ZipFile[]):ReadableStream<Uint8Array>{
  async function* produce(){
    const central:Uint8Array[]=[];let offset=0;
    for(const file of files){const name=encoder.encode(file.path),header=bytes(30+name.length),data=view(header);data.setUint32(0,0x04034b50,true);data.setUint16(4,20,true);data.setUint16(6,0x800,true);data.setUint32(14,file.crc32,true);data.setUint32(18,file.size,true);data.setUint32(22,file.size,true);data.setUint16(26,name.length,true);header.set(name,30);
      const zip64=offset>0xffffffff,extra=zip64?bytes(12):bytes(0);if(zip64){const info=view(extra);info.setUint16(0,1,true);info.setUint16(2,8,true);info.setBigUint64(4,BigInt(offset),true);}
      const row=bytes(46+name.length+extra.length),c=view(row);c.setUint32(0,0x02014b50,true);c.setUint16(4,45,true);c.setUint16(6,zip64?45:20,true);c.setUint16(8,0x800,true);c.setUint32(16,file.crc32,true);c.setUint32(20,file.size,true);c.setUint32(24,file.size,true);c.setUint16(28,name.length,true);c.setUint16(30,extra.length,true);c.setUint32(42,zip64?0xffffffff:offset,true);row.set(name,46);row.set(extra,46+name.length);central.push(row);
      yield header;offset+=header.length;let written=0;const body=await file.body();if(body instanceof Uint8Array){written=body.byteLength;yield body;}else{const reader=body.getReader();try{for(;;){const next=await reader.read();if(next.done)break;written+=next.value.byteLength;if(written>file.size)throw Error('A backup object changed size during download.');yield next.value;}}finally{reader.releaseLock();}}
      if(written!==file.size)throw Error('A backup object is incomplete. Retry the download.');offset+=written;
    }
    const centralOffset=offset;for(const row of central){yield row;offset+=row.length;}const centralSize=offset-centralOffset,needs64=files.length>=0xffff||centralOffset>0xffffffff||centralSize>0xffffffff;
    if(needs64){const end=bytes(56),v=view(end);v.setUint32(0,0x06064b50,true);v.setBigUint64(4,BigInt(44),true);v.setUint16(12,45,true);v.setUint16(14,45,true);v.setBigUint64(24,BigInt(files.length),true);v.setBigUint64(32,BigInt(files.length),true);v.setBigUint64(40,BigInt(centralSize),true);v.setBigUint64(48,BigInt(centralOffset),true);yield end;const locator=bytes(20),l=view(locator);l.setUint32(0,0x07064b50,true);l.setBigUint64(8,BigInt(offset),true);l.setUint32(16,1,true);yield locator;}
    const end=bytes(22),v=view(end);v.setUint32(0,0x06054b50,true);v.setUint16(8,needs64?0xffff:files.length,true);v.setUint16(10,needs64?0xffff:files.length,true);v.setUint32(12,needs64?0xffffffff:centralSize,true);v.setUint32(16,needs64?0xffffffff:centralOffset,true);yield end;
  }
  const iterator=produce();return new ReadableStream({async pull(controller){try{const next=await iterator.next();if(next.done)controller.close();else controller.enqueue(next.value);}catch(error){controller.error(error);}},async cancel(){await iterator.return(undefined);}});
}

export type BackupArchive={manifest:BackupManifest;read:(path:string)=>Blob;paths:string[]};
/** Read only the ZIP directory/manifest; evidence stays in file-backed Blob slices. */
export async function readBackupArchive(file:Blob):Promise<BackupArchive>{
  const tailStart=Math.max(0,file.size-65558),tail=new Uint8Array(await file.slice(tailStart).arrayBuffer()),t=view(tail);let end=-1;
  for(let position=tail.length-22;position>=0;position--)if(t.getUint32(position,true)===0x06054b50&&position+22+t.getUint16(position+20,true)===tail.length){end=position;break;}
  if(end<0)throw Error('The backup ZIP is incomplete or unsupported.');
  if(t.getUint16(end+4,true)||t.getUint16(end+6,true))throw Error('Split ZIP archives are not supported.');
  let count=t.getUint16(end+10,true),directorySize=t.getUint32(end+12,true),directoryOffset=t.getUint32(end+16,true);
  if(count===0xffff||directorySize===0xffffffff||directoryOffset===0xffffffff){const locatorPosition=tailStart+end-20;const locator=view(new Uint8Array(await file.slice(locatorPosition,locatorPosition+20).arrayBuffer()));if(locator.getUint32(0,true)!==0x07064b50)throw Error('The ZIP64 directory is missing.');const at=Number(locator.getBigUint64(8,true));if(!Number.isSafeInteger(at))throw Error('The archive is too large.');const info=view(new Uint8Array(await file.slice(at,at+56).arrayBuffer()));if(info.getUint32(0,true)!==0x06064b50||info.getUint32(16,true)||info.getUint32(20,true))throw Error('The ZIP64 directory is invalid.');count=Number(info.getBigUint64(32,true));directorySize=Number(info.getBigUint64(40,true));directoryOffset=Number(info.getBigUint64(48,true));}
  if(!Number.isSafeInteger(count)||count<1||count>MAX_BACKUP_ENTRIES+1||!Number.isSafeInteger(directoryOffset)||!Number.isSafeInteger(directorySize)||directorySize>24*1024*1024||directoryOffset<0||directoryOffset+directorySize>file.size)throw Error('The archive directory exceeds supported bounds.');
  const directory=new Uint8Array(await file.slice(directoryOffset,directoryOffset+directorySize).arrayBuffer()),d=view(directory),files=new Map<string,{offset:number;size:number;crc32:number}>();let position=0;
  for(let index=0;index<count;index++){if(position+46>directory.length||d.getUint32(position,true)!==0x02014b50)throw Error('The archive directory is damaged.');const flags=d.getUint16(position+8,true),method=d.getUint16(position+10,true),size=d.getUint32(position+24,true),compressed=d.getUint32(position+20,true),nameLength=d.getUint16(position+28,true),extraLength=d.getUint16(position+30,true),commentLength=d.getUint16(position+32,true);let offset=d.getUint32(position+42,true);const rowEnd=position+46+nameLength+extraLength+commentLength;if(rowEnd>directory.length)throw Error('The archive directory is truncated.');const path=new TextDecoder('utf-8',{fatal:true}).decode(directory.slice(position+46,position+46+nameLength));if((flags&1)||method!==0||size!==compressed||size>MAX_BACKUP_PART_BYTES||(path!=='manifest.json'&&!backupPath(path))||files.has(path))throw Error('The ZIP contains an unsupported or unsafe entry.');
    if(offset===0xffffffff){let extra=position+46+nameLength;const extraEnd=extra+extraLength;let found=false;while(extra+4<=extraEnd){const kind=d.getUint16(extra,true),length=d.getUint16(extra+2,true);if(extra+4+length>extraEnd)throw Error('Invalid ZIP64 entry.');if(kind===1&&length>=8){offset=Number(d.getBigUint64(extra+4,true));found=true;break;}extra+=4+length;}if(!found||!Number.isSafeInteger(offset))throw Error('Missing ZIP64 entry offset.');}
    files.set(path,{offset,size,crc32:d.getUint32(position+16,true)});position=rowEnd;
  }
  if(position!==directory.length||!files.has('manifest.json'))throw Error('The backup manifest is missing or the directory contains trailing data.');
  const slices=new Map<string,Blob>();const ranges:{start:number;end:number}[]=[];
  for(const [path,entry]of files){const header=new Uint8Array(await file.slice(entry.offset,entry.offset+30).arrayBuffer());if(header.length!==30)throw Error('An archive entry header is incomplete.');const h=view(header);if(h.getUint32(0,true)!==0x04034b50||h.getUint16(8,true)!==0)throw Error('An archive entry header is invalid.');const nameLength=h.getUint16(26,true),extraLength=h.getUint16(28,true),start=entry.offset+30+nameLength+extraLength,end=start+entry.size;if(entry.offset<0||end>directoryOffset||!Number.isSafeInteger(end))throw Error('An archive entry points outside the backup.');const localName=new TextDecoder('utf-8',{fatal:true}).decode(await file.slice(entry.offset+30,entry.offset+30+nameLength).arrayBuffer());if(localName!==path)throw Error('An archive filename does not match its directory.');slices.set(path,file.slice(start,end));ranges.push({start:entry.offset,end});}
  ranges.sort((a,b)=>a.start-b.start);for(let index=1;index<ranges.length;index++)if(ranges[index].start<ranges[index-1].end)throw Error('Archive entries overlap.');
  const manifestBlob=slices.get('manifest.json')!;if(manifestBlob.size>MAX_MANIFEST_BYTES)throw Error('The backup manifest is too large.');const manifestBytes=new Uint8Array(await manifestBlob.arrayBuffer());if(backupCrc32(manifestBytes)!==files.get('manifest.json')!.crc32)throw Error('The backup manifest checksum does not match.');let manifest:unknown;try{manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(manifestBytes));}catch{throw Error('The backup manifest is unreadable.');}validateBackupManifest(manifest);
  if(files.size!==manifest.entries.length+1)throw Error('The ZIP files do not match the manifest.');for(const entry of manifest.entries){const found=files.get(entry.path);if(!found||found.size!==entry.size||found.crc32!==entry.crc32)throw Error('A backup file does not match the manifest.');}
  return {manifest,paths:[...slices.keys()],read(path){const found=slices.get(path);if(!found)throw Error('Backup file not found.');return found;}};
}
