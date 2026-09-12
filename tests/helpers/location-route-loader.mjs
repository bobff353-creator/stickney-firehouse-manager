// Test-only dependency injection: real routes, permissions, SQL adapter and SQL
// execute against PGlite. No hosted Supabase client or credential is initialized.
import {registerHooks,stripTypeScriptTypes} from 'node:module';
import {existsSync,readFileSync} from 'node:fs';
registerHooks({resolve(specifier,context,next){
 if(specifier==='server-only')return{url:'data:text/javascript,export{}',shortCircuit:true};
 if(specifier.startsWith('.')&&context.parentURL?.startsWith('file:')&&!context.parentURL.includes('/node_modules/')){
  let url=new URL(specifier,context.parentURL);if(!/\.[cm]?[jt]sx?$/.test(url.pathname)){
   if(existsSync(new URL(url.href+'.ts')))url=new URL(url.href+'.ts');
   else if(existsSync(new URL(url.href+'/index.ts')))url=new URL(url.href+'/index.ts');
  }
  if(/\/app\/supabase-(server|system)\.ts$/.test(url.pathname))return{url:'data:text/javascript,export async function getSupabaseServerClient(){return globalThis.__locationFixtureSupabase}; export const getSupabaseSystemClient=getSupabaseServerClient;',shortCircuit:true};
  return next(url.href,context);
 }return next(specifier,context);
},load(url,context,next){
 if(url.endsWith('/db/postgres-adapter.ts'))return{format:'module',source:stripTypeScriptTypes(readFileSync(new URL(url),'utf8'),{mode:'transform',sourceUrl:url}),shortCircuit:true};
 return next(url,context);
}});
