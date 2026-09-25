import {ensureDatabase} from '../../../../db/bootstrap';
import {inspectionBoundary,inspectionJson} from '../../../fire-inspections/server';
import {loadReport,buildInspectionPdf} from '../../../fire-inspections/report-pdf';
export const runtime='nodejs';
export async function GET(request:Request){const denied=inspectionBoundary(request);if(denied)return denied;try{const p=new URL(request.url).searchParams,{record,photos}=await loadReport(await ensureDatabase(),request.headers.get('x-department-id')!,p.get('recordId')||'',Number(p.get('version'))),pdf=await buildInspectionPdf(record,photos);return new Response(Buffer.from(pdf),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="inspection-${record.id}-v${record.version}.pdf"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}catch(e){return inspectionJson({error:e instanceof Error?e.message:'Report could not be created. Please retry.'},400);}}
