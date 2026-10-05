import { reviewPackage, type NerisFile, type NerisRecord } from './model';
import { validateReport } from './validation';
export function savedReviewPackage(record: NerisRecord, attachments: NerisFile[], departmentId: string) {
  if (record.kind !== 'incident' || record.version < 1) throw Error('Choose a saved incident report.');
  return { ...reviewPackage(record), version: 2, departmentId,
    savedVersion: { id: record.id, version: record.version, updatedAt: record.updatedAt, updatedBy: record.updatedBy, archived: record.archived, test: record.data.local.test },
    validation: { scope: 'Local pinned schema and local review rules only', officialValidation: false, issues: validateReport(record.data) },
    source: { cadSourceId: record.data.local.cadSourceId || null, note: 'Source ID links the original saved CAD call. Narrative and incident facts still require human review.' },
    attachments: attachments.map(file => ({ id: file.id, recordId: file.recordId, filename: file.filename, size: file.size, contentType: file.contentType, createdAt: file.createdAt, downloadUrl: `/api/neris/files/${encodeURIComponent(file.id)}` })),
    attachmentNote: 'Current private attachment metadata captured at export. File bytes are not included; downloads require an authorized portal session. Attachments are not a historical version snapshot.',
  };
}
