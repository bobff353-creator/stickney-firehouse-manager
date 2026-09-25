# Requires pypdf. Run from the repository root. Review changes before publishing.
import json,re,hashlib,urllib.request,concurrent.futures
from pathlib import Path
from pypdf import PdfReader
root=Path('work/training-sources'); root.mkdir(parents=True,exist_ok=True)
catalog_text=Path('app/training/osfm-catalog.ts').read_text(encoding='utf8')
catalog=json.loads(catalog_text[catalog_text.index('[\n'):catalog_text.rindex(']')+1])

# Search aids inferred from published TASK headings, not copied task instructions.
topic_patterns={
 'Ladders':r'ladder', 'Hose':r'hose|nozzle', 'SCBA':r'SCBA|self.contained',
 'Respirators':r'respirator|supplied.air|SARs', 'Search':r'search', 'Rescue':r'rescue|victim',
 'Confined space':r'confined space', 'Rope':r'rope|knot|rappel', 'Trench':r'trench',
 'Collapse':r'collapse|shoring|breach|cribbing', 'Vehicle':r'vehicle|automobile|extricat',
 'Water':r'water|swim|boat|watercraft', 'Hazmat':r'hazardous.material|decontamin|chemical',
 'Fire':r'\bfire\b|extinguish', 'Ventilation':r'ventilat', 'Forcible entry':r'forcible|force.entry',
 'Alarm':r'alarm', 'Communication':r'communicat|radio|report|message',
 'Inspection':r'inspect|code|compliance', 'Investigation':r'investigat|evidence',
 'Training':r'train|instruct|lesson|teach', 'Command':r'command|incident.action|size.up',
 'Planning':r'plan', 'Safety':r'safe|hazard|risk', 'Equipment':r'equipment|tools',
 'PPE':r'PPE|protective', 'Driving':r'driv|operat.*apparatus', 'Pump':r'pump',
 'Maintenance':r'maintain|maintenance|clean', 'Medical':r'medical|patient|first.aid',
}
def enrich_jprs(ids,pages):
 result=[]
 for identifier,index_page in ids.items():
  row={'id':identifier,'page':index_page}
  for n,text in enumerate(pages):
   match=re.search(r'\bTASK\s*:\s*(.*?)(?=PERFORMANCE|CONDITIONS|EQUIPMENT|OBJECTIVE|$)',text,re.S|re.I)
   if not match:continue
   header=text[max(0,match.start()-450):match.start()]
   if not re.search(r'(?<![\d.\-])'+re.escape(identifier)+r'(?![\d.\-])',header):continue
   row['taskPage']=n+1
   row['topics']=[label for label,pattern in topic_patterns.items() if re.search(pattern,match[1],re.I)]
   break
  result.append(row)
 return result
def get(pair):
 c,kind,url=pair
 p=root/(c['id']+'-'+kind+'.pdf')
 try:
  if not p.exists():
   with urllib.request.urlopen(url,timeout=60) as response:p.write_bytes(response.read())
  pages=[page.extract_text() or '' for page in PdfReader(p).pages]
  front=re.sub(r'\s+', ' ', ' '.join(pages[:2])); edition=re.search(r'NFPA\)?\s*(\d+).*?\((\d{4}) Edition\)',front,re.S|re.I)
  cover=re.search(r'(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+(?:\d{1,2},?\s+)?(20\d\d)',pages[0],re.I)
  ids={}
  for n,text in enumerate(pages):
   if 'ROFICIENCY LOG' not in text.upper(): continue
   for m in re.finditer(r'(?m)^\s*(\d{1,2}\.\d{1,2}\.\d{1,2}(?:\.\d{1,2})?(?:-\d{1,3})?)\b',text): ids.setdefault(m.group(1),n+1)
  if kind=='initialBook' and c['id'] in ['il-309','il-315']:
   for n,text in enumerate(pages):
    for line in text.splitlines():
     if re.match(r'^NFPA\s+',line) and re.search(r'(?:CoFO|AdFO)\s*#',line,re.I):
      for m in re.finditer(r'(\d+\.\d+\.\d+)',line):ids.setdefault(m[1],n+1)
   edition=re.search(r'NFPA\s*(1021),?\s*\(?((?:20)\d{2})\s*Edition', ' '.join(pages),re.I)
  if kind=='initialBook' and c['id']=='il-329':
   for n,text in enumerate(pages):
    for line in text.splitlines():
     if '□' in line:
      for m in re.finditer(r'(\d+\.\d+\.\d+)',line):ids.setdefault(m[1],n+1)
  (root/(c['id']+'-'+kind+'.txt')).write_text('\n\n'.join(pages),encoding='utf8')
  return {'certificationId':c['id'],'kind':kind,'url':url,'title':c['title'],'edition':('NFPA '+edition[1]+' ('+edition[2]+')') if edition else 'Check the official book edition','bookDate':cover.group(0).title() if cover else '', 'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'pageCount':len(pages),'jprs':enrich_jprs(ids,pages),'reviewedAt':'2026-09-24'}
 except Exception as e:return {'certificationId':c['id'],'kind':kind,'url':url,'error':str(e)}
jobs=[(c,k,c[k]) for c in catalog for k in ['recertificationBook','initialBook'] if c[k]]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex: rows=list(ex.map(get,jobs))
Path('app/training/osfm-books.json').write_text(json.dumps(rows,indent=2),encoding='utf8')
print(json.dumps([{'id':r['certificationId'],'kind':r['kind'],'jprs':len(r.get('jprs',[])),'edition':r.get('edition'),'date':r.get('bookDate'),'error':r.get('error')} for r in rows],indent=2))
