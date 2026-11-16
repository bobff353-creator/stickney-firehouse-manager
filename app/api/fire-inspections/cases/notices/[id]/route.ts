import {nativeReportActionDocument} from '../../../../../fire-inspections/case-service';
import {nativeCaseError,nativeCaseAccess} from '../../../../../fire-inspections/case-runtime';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{return new Response(await nativeReportActionDocument(await nativeCaseAccess(request),(await params).id),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox"}});}catch(error){return nativeCaseError(error);}}
