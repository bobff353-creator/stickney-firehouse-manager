import {PDFDocument,rgb,type PDFFont,type PDFPage} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {disciplinaryDate,signatureLabels,type DisciplinaryFile,type DisciplinaryVersion,type SignatureKey} from './model';
export async function disciplinaryPdf(id:string,version:DisciplinaryVersion,files:DisciplinaryFile[]){
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const [regularBytes,boldBytes]=await Promise.all([readFile(join(process.cwd(),'assets/inspection-fonts/LiberationSans-Regular.ttf')),readFile(join(process.cwd(),'assets/inspection-fonts/LiberationSans-Bold.ttf'))]);
 const regular=await pdf.embedFont(regularBytes,{subset:true}),bold=await pdf.embedFont(boldBytes,{subset:true});
 const content=version.content;const width=612,height=792,margin=44;let page!:PDFPage;let y=0;
 const next=()=>{page=pdf.addPage([width,height]);y=height-margin;page.drawText('STICKNEY FIRE DEPARTMENT',{x:margin,y,size:11,font:bold,color:rgb(.06,.15,.22)});y-=20;page.drawText('Disciplinary Action · Confidential',{x:margin,y,size:16,font:bold});y-=26;};
 const line=(text:string,font:PDFFont=regular,size=10)=>{if(y<margin+40)next();page.drawText(text,{x:margin,y,size,font});y-=size+5;};
 const text=(value:string,size=10)=>{for(const paragraph of value.replace(/\r/g,'').split('\n')){let part='';for(const word of paragraph.split(/\s+/)){if(regular.widthOfTextAtSize(part?part+' '+word:word,size)>width-margin*2&&part){line(part,regular,size);part='';}if(regular.widthOfTextAtSize(word,size)>width-margin*2){for(const char of word){if(regular.widthOfTextAtSize(part+char,size)>width-margin*2){line(part,regular,size);part='';}part+=char;}}else part+=(part?' ':'')+word;}line(part||' ',regular,size);}};
 const field=(label:string,value:string)=>{line(label,bold);text(value||'Not recorded');y-=7;};
 next();text(`Report ${id} · Version ${version.version} · ${version.status==='submitted'?'Submitted':'Draft'}`);text(`Saved ${disciplinaryDate(version.saved_at)} by ${version.actor_name}`);y-=12;
 field('Employee name',content.employeeName||'');field('Date / time of incident',[content.incidentDate,content.incidentTime].filter(Boolean).join(' · '));field('Incident number',content.incidentNumber);field('Supervisor making report',content.supervisorName||'');field('Discipline step taken',content.disciplineStep);field('Previous discipline within the past year',content.previousDiscipline);field('Contributing factors',content.factors.join('\n'));field('Additional details',content.details);field('Recommended corrective actions',content.correctiveActions);field('Documentation provided',content.documentationProvided);field('Employee response: understands the nature of the action',content.employeeResponse);field('Employee comments',content.employeeComments);
 field('Formal documentation and supporting documents',files.filter(file=>content.fileIds.includes(file.id)).map(file=>`${file.original_filename} · SHA-256 ${file.sha256}`).join('\n'));
 for(const key of Object.keys(signatureLabels) as SignatureKey[]){const signature=content.signatures[key];if(y<180)next();line(signatureLabels[key],bold);if(signature){const image=await pdf.embedPng(Buffer.from(signature.image.split(',')[1],'base64'));const dimensions=image.scaleToFit(width-margin*2,75);page.drawImage(image,{x:margin,y:y-dimensions.height,width:dimensions.width,height:dimensions.height});y-=dimensions.height+15;text(signature.name);if(signature.recordedAt)text(`Recorded ${disciplinaryDate(signature.recordedAt)} by ${signature.recordedBy||'Not recorded'}`,9);}else text('Not signed');y-=14;}
 if(version.change_reason)field('Reason for this saved correction',version.change_reason);
 const pages=pdf.getPages();pages.forEach((p,index)=>p.drawText(`Confidential personnel record · Version ${version.version} · Page ${index+1} of ${pages.length}`,{x:margin,y:24,size:8,font:regular,color:rgb(.3,.35,.4)}));
 pdf.setTitle(`Disciplinary Action — ${content.employeeName||id} — version ${version.version}`);return Buffer.from(await pdf.save());
}
