import {inspectionJson} from '../../../../fire-inspections/server';
import {uploadNativeCaseProof,InspectionCaseError} from '../../../../fire-inspections/case-service';
import {nativeCaseError,nativeCaseAccess} from '../../../../fire-inspections/case-runtime';
export const dynamic='force-dynamic';export const maxDuration=60;
export async function POST(request:Request){try{if(Number(request.headers.get('content-length')??0)>4*1024*1024)throw new InspectionCaseError('Choose a proof image up to 3.5 MB.',413);const context=await nativeCaseAccess(request,'corrections.write'),form=await request.formData(),file=form.get('file');if(!(file instanceof File))throw new InspectionCaseError('Choose a proof image.');return inspectionJson(await uploadNativeCaseProof(context,{id:form.get('id'),caseId:form.get('caseId'),file}));}catch(error){return nativeCaseError(error);}}
