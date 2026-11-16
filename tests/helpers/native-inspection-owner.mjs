// Existing workflow fixtures exercise data behavior under a verified owner.
// inspection-native-staff.test.mjs separately runs the actual portal verifier.
import {resolve} from 'node:path';
import {INSPECTION_PILOT_EMAIL} from '../../app/fire-inspections/access.ts';
export function nativeOwnerAccessOverrides(overrides={}){
 class NativeInspectionAccessError extends Error{constructor(message,status=403,code='INSPECTION_ACCESS'){super(message);this.status=status;this.code=code;}}
 const contexts=new WeakMap();
 const accessFixture={NativeInspectionAccessError,async requireNativeInspectionAccess(request){
  if(request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase()!==INSPECTION_PILOT_EMAIL||!request.headers.get('x-department-id'))throw new NativeInspectionAccessError('Fixture owner access denied.');
  if(request.method!=='GET'&&(request.headers.get('sec-fetch-site')==='cross-site'||request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin))throw new NativeInspectionAccessError('Fixture request origin denied.');
  let context=contexts.get(request);if(!context){context={departmentId:request.headers.get('x-department-id'),userId:'qa-verified-owner',email:INSPECTION_PILOT_EMAIL,role:'owner',memberId:'owner',employeeId:'pilot-owner',permissions:[],rolloutEnabled:false,db:await overrides[resolve('db/bootstrap.ts')]?.ensureDatabase?.()};contexts.set(request,context);}return context;
 },nativeCan:()=>true,assertNativeInspectionWrite(){},assertNativeAssignedCase(){},nativePublicAccess(context){const {db,...result}=context;void db;return result;}};
 return {[resolve('app/fire-inspections/access-context.ts')]:accessFixture};
}
