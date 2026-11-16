import {readNativeCaseProof} from '../../../../../fire-inspections/case-service';
import {nativeCaseError,nativeCaseAccess} from '../../../../../fire-inspections/case-runtime';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{const result=await readNativeCaseProof(await nativeCaseAccess(request),(await params).id);return new Response(result.blob,{headers:{'Content-Type':result.file.contentType,'Content-Disposition':"inline; filename*=UTF-8''"+encodeURIComponent(result.file.filename),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});}catch(error){return nativeCaseError(error);}}
