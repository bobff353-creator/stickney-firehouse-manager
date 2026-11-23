import { ensureDatabase } from "../../../db/bootstrap";
import { getPortalDepartment } from "../../department-portal";
import { permissionsForEmail } from "../../server-permissions";
import type { PermissionKey } from "../../permissions";

export class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
export async function identity(request:Request,permission:PermissionKey="field_preplans.view") {
  const db=await ensureDatabase(),email=request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase()||"";
  const permissions=await permissionsForEmail(email,db);
  if(!permissions.has(permission))throw new HttpError(403,"Your department account does not have permission for this preplan action.");
  if(request.method!=="GET"&&request.method!=="HEAD"){
    const origin=request.headers.get("origin");if(origin!==new URL(request.url).origin)throw new HttpError(403,"Open Firehouse Manager directly and retry.");
  }
  const department=await getPortalDepartment();
  return {db,email,department,permissions};
}
export function json(value:unknown,status=200){return Response.json(value,{status,headers:{"cache-control":"private, no-store","x-content-type-options":"nosniff"}});}
export async function handle(run:()=>Promise<Response>){try{return await run();}catch(error){if(error instanceof HttpError)return json({error:error.message},error.status);return json({error:"This action could not be confirmed. Your saved records are intact. Keep your device draft and retry."},500);}}
export function validId(value:unknown){if(typeof value!=="string"||!(/^[a-zA-Z0-9-]{1,100}$/).test(value))throw new HttpError(400,"Invalid preplan record ID.");return value;}
export async function body(request:Request){if(Number(request.headers.get("content-length"))>200000)throw new HttpError(413,"This preplan is too large.");const text=await request.text();if(text.length>200000)throw new HttpError(413,"This preplan is too large.");try{return JSON.parse(text) as Record<string,unknown>;}catch{throw new HttpError(400,"The request could not be read.");}}
