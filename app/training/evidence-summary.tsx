import type {TrainingRecord,TrainingSnapshot} from './model';
import {evidenceSummary} from './reporting';
export default function EvidenceSummary({record,snapshot}:{record:TrainingRecord;snapshot:TrainingSnapshot}){
 const summary=evidenceSummary(record,snapshot);
 return <section className="tr-panel" aria-label="Record evidence summary"><h3>Evidence at a glance</h3><dl className="tr-review"><dt>Original files</dt><dd>{summary.files.length} saved attachment{summary.files.length===1?'':'s'}</dd><dt>Source</dt><dd>{summary.source}</dd><dt>Author review</dt><dd>{summary.review}</dd><dt>Unresolved source rows</dt><dd>{summary.unresolved}</dd><dt>Training references</dt><dd>{summary.selectedReferences} selected</dd><dt>Activity fields</dt><dd>{summary.recordedFields} with recorded answers</dd></dl><p>Attachments and selected objectives support review; they do not independently prove proficiency or official acceptance.</p>{summary.files.map(file=><a key={file.id} className="tr-file" href={'/api/training/files/'+file.id} target="_blank" rel="noreferrer">{file.filename} · Open saved evidence</a>)}</section>;
}
