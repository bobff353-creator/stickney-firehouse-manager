// Presentation only. The complete original notes stay in the stored record
// and in Data & imports. Remove the known transfer boilerplate, retaining
// maintenance/access observations and deduplicating repeated source notes.
export function hydrantNotes(notes:string){
 const clean=notes
  .replace(/Imported from FlowMSP on \d{4}-\d{2}-\d{2}; source export \d{4}-\d{2}-\d{2}\. Needs field verification\.\s*/gi,'')
  .replace(/FlowMSP source ID:\s*[0-9a-f-]{36}\.\s*/gi,'')
  .replace(/Original FlowMSP GPS coordinates retained; the provider-generated address is display-only\.\s*/gi,'')
  .replace(/FlowMSP reported flow:\s*[\d,.]+ GPM \([A-Z]+\)\.\s*/gi,'');
 return [...new Set(clean.split(/\r?\n/).map(line=>line.trim()).filter(Boolean))].join('\n');
}
