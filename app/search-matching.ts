/** Literal, deterministic matching; never generates or modifies record content. */
export function normalizeSearch(value: string) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[’']/g, '').replace(/(\d)\.(?=\d)/g, '$1\uE000')
    .replace(/\b(?:self[ -]?contained breathing apparatus|air[ -]?packs?)\b/g, 'scba')
    .replace(/\bhydrants\b/g, 'hydrant').replace(/\binspections\b/g, 'inspection')
    .replace(/[^\p{L}\p{N}%_\\*\uE000]+/gu, ' ').replace(/\uE000/g, '.').trim();
}
export function searchTerms(query: string) {
  return [...new Set(normalizeSearch(query).split(/\s+/).filter(word => word && !['find', 'show', 'me', 'the', 'a', 'an'].includes(word)))];
}
export function searchScore(title: string, detail: string, query: string, type = '') {
  const terms = searchTerms(query), name = normalizeSearch(title);
  if (!terms.length) return 0;
  const all = `${name} ${normalizeSearch(detail)} ${normalizeSearch(type)}`;
  if (!terms.every(term => all.includes(term))) return 0;
  const typeWords=normalizeSearch(type).split(/\s+/);
  const titleTerms=terms.filter(term=>!typeWords.includes(term));
  if(!titleTerms.length)return 30;
  const phrase = titleTerms.join(' ');
  return name === phrase ? 100 : name.startsWith(phrase) ? 85 : name.includes(phrase) ? 75
    : titleTerms.every(term => name.includes(term)) ? 65 : 40;
}
export function searchExcerpt(detail: string, query: string, limit = 180) {
  if (detail.length <= limit) return detail;
  const positions = searchTerms(query).map(term => detail.toLowerCase().indexOf(term)).filter(index => index >= 0);
  const start = positions.length ? Math.max(0, Math.min(...positions) - 45) : 0;
  return `${start ? '…' : ''}${detail.slice(start, start + limit)}${start + limit < detail.length ? '…' : ''}`;
}
