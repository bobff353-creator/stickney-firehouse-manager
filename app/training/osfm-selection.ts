import books from './osfm-books.json';
import descriptions from './osfm-task-descriptions.json';
import { certificationCatalog } from './osfm-catalog';

export type OsfmJpr = {id:string;page:number;taskPage?:number;topics?:string[]};
export type OsfmBook = Omit<typeof books[number],'jprs'> & {jprs:OsfmJpr[]};
export const osfmBooks:OsfmBook[] = books;
export const bookKey = (book:OsfmBook) => `${book.certificationId}:${book.kind}`;
export const taskKey = (book:OsfmBook,jpr='') => `${bookKey(book)}:${jpr}`;
export const bookKindLabel = (book:OsfmBook) => book.kind==='initialBook'?'Initial certification':'Recertification';
type TaskDescription = {title:string;description:string};
const reviewedDescriptions:Record<string,{sourceSha256:string;reviewedAt:string;tasks:Record<string,TaskDescription>}> = descriptions;
// A JPR number can mean different things in different books and editions.
export function taskDescription(book:OsfmBook,jpr:string):TaskDescription|null {
  const reviewed=reviewedDescriptions[bookKey(book)];
  return reviewed?.sourceSha256===book.sha256&&book.jprs.some(j=>j.id===jpr)?reviewed.tasks[jpr]??null:null;
}
function taskSearchText(book:OsfmBook,task:OsfmJpr) {
  const summary=taskDescription(book,task.id);
  return [task.id,...task.topics??[],summary?.title,summary?.description].filter(Boolean).join(' ').toLowerCase();
}
export function searchBookTasks(book:OsfmBook,query:string) {
  const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return book.jprs.filter(task=>terms.every(term=>taskSearchText(book,task).includes(term)));
}
export function taskReference(key:string) {
  const [certificationId,kind,jpr,...extra]=key.split(':');
  if(extra.length||jpr===undefined)return null;
  const book=osfmBooks.find(b=>b.certificationId===certificationId&&b.kind===kind);
  if(!book)return null;
  const task=book.jprs.find(t=>t.id===jpr);
  if(jpr&&!task)return null;
  return {book,jpr,summary:taskDescription(book,jpr),page:task?.taskPage??task?.page??1,label:`${book.title} · ${bookKindLabel(book)} · ${jpr?'JPR '+jpr:'Official book / form'}`};
}
export function normalizeOsfmSelections(value:unknown,hashes:unknown) {
  if(value!==undefined&&!Array.isArray(value))throw new Error('Choose OSFM tasks from the official task-book list.');
  const ids=[...new Set((value??[]) as unknown[])];
  if(ids.length>1000)throw new Error('Choose no more than 1,000 OSFM task references in one training.');
  const recorded=hashes&&typeof hashes==='object'?hashes as Record<string,unknown>:{};
  const fingerprints:Record<string,string>={};
  for(const id of ids){
    const reference=typeof id==='string'?taskReference(id):null;
    if(!reference)throw new Error('An OSFM task is not in the verified index. Choose it again from the task books.');
    const key=bookKey(reference.book);
    if(recorded[key]&&recorded[key]!==reference.book.sha256)throw new Error('An official task-book edition changed. Review the source and reselect the applicable tasks.');
    fingerprints[key]=reference.book.sha256;
  }
  return {ids:ids as string[],fingerprints};
}
export function searchCertifications(query:string) {
  const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return certificationCatalog.filter(c=>{
    const related=osfmBooks.filter(b=>b.certificationId===c.id);
    const text=[c.title,c.section,...related.flatMap(b=>[b.edition,bookKindLabel(b),...b.jprs.map(j=>taskSearchText(b,j))])].join(' ').toLowerCase();
    return terms.every(term=>text.includes(term));
  });
}
