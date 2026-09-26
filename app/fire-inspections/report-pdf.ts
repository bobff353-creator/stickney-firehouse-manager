import {alternativeReviewLines,emptyAlternativeReview} from './alternative-review';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {PDFDocument,rgb,type PDFFont} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import sharp from 'sharp';
import {getSupabaseServerClient} from '../supabase-server';
import {codeLabel,type CodeSelection} from './codes';
import {blankSignature,type InspectionRecord,type Signature} from './model';
import {decodeInspection,inspectionColumns,type StoredInspection,type InspectionDb} from './server';

export type ReportPhoto={id:string;checkId:string;caption:string;filename:string;bytes:Uint8Array};
const bucket='stickney-fire-inspections-pilot';
export async function loadReport(db:InspectionDb,department:string,id:string,version:number){
 const row=await db.prepare(`SELECT ${inspectionColumns} FROM fire_inspection_pilot_records WHERE department_id=? AND id=?`).bind(department,id).first<StoredInspection>();
 if(!row)throw Error('Inspection not found.');
 const record=decodeInspection(row);if(record.kind!=='inspection')throw Error('Choose an inspection, not a checklist.');
 if(record.version!==version)throw Error('This report changed. Refresh before downloading or emailing it.');
 const rows=(await db.prepare('SELECT id,check_id checkId,caption,filename,object_key objectKey,size_bytes size FROM fire_inspection_pilot_files WHERE department_id=? AND record_id=? AND content_type LIKE ? ORDER BY created_at,id').bind(department,id,'image/%').all<{id:string;checkId:string;caption:string;filename:string;objectKey:string;size:number}>()).results;
 if(rows.length>60||rows.reduce((n,f)=>n+f.size,0)>100*1024*1024)throw Error('This report has more than 60 photos or 100 MB of source images. Reduce the photos before creating the PDF.');
 const photos:ReportPhoto[]=[],client=await getSupabaseServerClient();
 // Process one photo at a time to keep server memory bounded; originals remain untouched.
 for(const f of rows){const {data,error}=await client.storage.from(bucket).download(f.objectKey);if(error||!data)throw Error(`Could not include photo ${f.filename}. Retry when it is available.`);const bytes=await sharp(Buffer.from(await data.arrayBuffer()),{limitInputPixels:40_000_000}).rotate().resize({width:1400,height:1100,fit:'inside',withoutEnlargement:true}).flatten({background:'#fff'}).jpeg({quality:72}).toBuffer();photos.push({...f,bytes});}
 return{record,photos};
}

export async function buildInspectionPdf(record:InspectionRecord,photos:ReportPhoto[]=[]) {
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
 const [regularBytes,boldBytes]=await Promise.all([readFile(join(process.cwd(),'assets/inspection-fonts/LiberationSans-Regular.ttf')),readFile(join(process.cwd(),'assets/inspection-fonts/LiberationSans-Bold.ttf'))]);
 const regular=await doc.embedFont(regularBytes,{subset:true}),bold=await doc.embedFont(boldBytes,{subset:true}),d=record.data;
 doc.setTitle(`${d.test?'TEST - ':''}Fire inspection - ${d.title}`);doc.setAuthor('Stickney Fire Department');doc.setCreationDate(new Date(record.updatedAt));doc.setModificationDate(new Date(record.updatedAt));
 const margin=44,width=524,ink=rgb(.08,.16,.23),muted=rgb(.31,.39,.45);let page=doc.addPage([612,792]),y=748;
 const glyphs=new Set(regular.getCharacterSet());
 function clean(t:string){for(const c of t){if(!'\n\r\t'.includes(c)&&!glyphs.has(c.codePointAt(0)!))throw Error(`The report contains a character the PDF font cannot render (${c}). Replace it before downloading or emailing.`);}return t.replace(/\r/g,'').replace(/\t/g,'    ');}
 function newPage(){page=doc.addPage([612,792]);y=748;}
 function room(height:number){if(y-height<48)newPage();}
 function text(value:string,size=10,font:PDFFont=regular,color=ink){const source=clean(value);for(const paragraph of source.split('\n')){let line='';for(const word of paragraph.split(' ')){const candidate=line?line+' '+word:word;if(font.widthOfTextAtSize(candidate,size)<=width){line=candidate;continue;}if(line){room(size+5);page.drawText(line,{x:margin,y,size,font,color});y-=size+5;line='';}let part='';for(const char of word){if(font.widthOfTextAtSize(part+char,size)>width){room(size+5);page.drawText(part,{x:margin,y,size,font,color});y-=size+5;part='';}part+=char;}line=part;}room(size+5);page.drawText(line,{x:margin,y,size,font,color});y-=size+5;}y-=4;}
 function heading(value:string){room(54);y-=10;text(value,13,bold);page.drawLine({start:{x:margin,y:y+5},end:{x:568,y:y+5},thickness:.5,color:rgb(.8,.84,.87)});y-=6;}
 function pair(label:string,value:string){text(`${label}: ${value||'Not recorded'}`);}
 function reference(c:CodeSelection){text(`${codeLabel(c)} (library version ${c.version})`,10,bold);if(c.text)text(c.text);if(c.applicability)pair('Applicability / adoption notes',c.applicability);if(c.sourceUrl)pair('Source',c.sourceUrl);}
 async function photo(f:ReportPhoto){const img=await doc.embedJpg(f.bytes),scale=Math.min(width/img.width,280/img.height,1),w=img.width*scale,h=img.height*scale;room(h+58);page.drawImage(img,{x:margin,y:y-h,width:w,height:h});y-=h+16;text(f.caption||f.filename,9,regular,muted);}
 function signature(label:string,s:Signature){heading(label);pair('Status',s.state);pair('Name / role',[s.name,s.role].filter(Boolean).join(' - '));if(s.state==='Signed'){room(100);for(const stroke of s.strokes)for(let i=1;i<stroke.length;i++)page.drawLine({start:{x:margin+stroke[i-1][0]*width,y:y-stroke[i-1][1]*80},end:{x:margin+stroke[i][0]*width,y:y-stroke[i][1]*80},thickness:1.3,color:ink});y-=90;pair('Captured',s.signedAt);}}
 text('STICKNEY FIRE DEPARTMENT',11,bold,muted);text(d.test?'TEST / TRAINING INSPECTION REPORT':'FIRE INSPECTION REPORT',19,bold);text(d.title,16,bold);text(d.address,11);pair('Status / report version',`${d.status} / ${record.version}`);pair('Record',record.id);if(d.status!=='Completed')text('DRAFT - This inspection has not been completed.',12,bold,rgb(.65,.2,.1));
 heading('Visit and property');for(const [k,v]of [['Type',d.type],['Inspection date',d.actualDate],['Inspector',d.inspector],['Visit times',[d.startTime,d.endTime].filter(Boolean).join(' - ')],['Other inspectors',d.others],['Occupancy / use',d.occupancy],['Owner',d.owner],['Contact',[d.contact,d.email,d.phone].filter(Boolean).join(' / ')],['Reason',d.reason],['Outcome',d.outcome]])pair(k,v);
 heading('Applicable codes / editions');pair('Entered code basis',d.codeEdition);pair('Local amendments',d.localAmendments);for(const c of d.codeBasis||[])reference(c);if(!d.codeBasis?.length)text('No code library selections recorded.');
 heading('Findings and checklist');for(const c of d.checks){room(90);text(`${c.label} - ${c.result}`,12,bold);pair('Topic',c.section);if(['Needs attention','Corrected on site','Not inspected'].includes(c.result)||c.observation){pair('Location',c.location);pair('Observation',c.observation);pair('Action / correction',c.correction);pair('Priority',c.priority);pair('Correction due',c.dueDate);pair('Corrected date',c.correctedDate);}if(c.code)pair('Entered citation',c.code);for(const code of c.citations||[])reference(code);for(const f of photos.filter(f=>f.checkId===c.id))await photo(f);y-=8;}
 const other=photos.filter(f=>!f.checkId||!d.checks.some(c=>c.id===f.checkId));if(other.length){heading('Additional evidence');for(const f of other)await photo(f);}
 const review=alternativeReviewLines(d.alternativeReview??emptyAlternativeReview());if(review.length){heading('Alternative Safety Review');for(const line of review.slice(1))text(line);}
 heading('Next steps');pair('Notes',d.notes);pair('Reinspection decision',d.reinspectionDecision);pair('Reinspection date / time',[d.followUpDate,d.reinspectionTime].filter(Boolean).join(' '));pair('Reason no reinspection is needed',d.reinspectionReason);pair('Next routine due',d.nextDueDate);if(d.reinspectionDecision==='Needs scheduling')text('A reinspection appointment still needs to be arranged.');
 signature('Representative acknowledgment',d.representative);text('A representative signature acknowledges receipt of the recorded observations and does not change a finding.',9,regular,muted);signature('Inspector signature',d.inspectorSignature||blankSignature());pair('Inspector review',d.inspectorAttested?'Acknowledged':'Not acknowledged');pair('Saved by',`${record.updatedBy} / ${record.updatedAt}`);text('Email delivery is recorded separately in the portal. Downloading this PDF is not confirmation of delivery.',9,regular,muted);
 const pages=doc.getPages();pages.forEach((p,i)=>p.drawText(`${d.test?'TEST | ':''}Inspection version ${record.version} | Page ${i+1} of ${pages.length}`,{x:margin,y:24,font:regular,size:8,color:muted}));
 const result=await doc.save();if(result.length>4*1024*1024)throw Error('The PDF exceeds 4 MB. Reduce photo count or size before emailing it.');return result;
}
