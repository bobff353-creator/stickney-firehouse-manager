import {inspectionJson} from '../../../fire-inspections/server';
import {nativeCaseSnapshot} from '../../../fire-inspections/case-service';
import {nativeCaseError,nativeCaseAccess} from '../../../fire-inspections/case-runtime';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return inspectionJson(await nativeCaseSnapshot(await nativeCaseAccess(request)));}catch(error){return nativeCaseError(error);}}
