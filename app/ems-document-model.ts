export const EMS_MAX_BYTES = 4 * 1024 * 1024;
export function emsFileName(title: string, id: string) {
  const clean = title.trim().replace(/[^a-zA-Z0-9 _()-]/g, '').replace(/\s+/g, ' ').slice(0, 100).trim();
  if (!clean) throw new Error('Enter a document title using letters or numbers.');
  return `${id}--${clean}.pdf`;
}
export function validEmsFileName(name: string) {
  return /^[a-f0-9-]{36}--[a-zA-Z0-9 _()-]{1,100}\.pdf$/.test(name);
}
export function emsDocument(name: string) {
  return {name, title:name.slice(38,-4), href:`/api/ems-documents?file=${encodeURIComponent(name)}`};
}
export async function validEmsPdf(file: Blob) {
  return file.size > 0 && file.size <= EMS_MAX_BYTES && new TextDecoder().decode(await file.slice(0,5).arrayBuffer()) === '%PDF-';
}
