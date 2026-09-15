import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {pinLoginError,loginServiceUnavailable} from '../app/login-response.ts';

test('HTML/JSON server errors never blame the PIN or expose internal credentials',()=>{
 for(const status of [500,502,503,504])for(const payload of [{},{error:'Invalid database credential SECRET'},null,'<html>Error</html>']){
  assert.equal(pinLoginError(status,payload),loginServiceUnavailable);
  assert.doesNotMatch(pinLoginError(status,payload),/not correct|SECRET|database credential/);
 }
 assert.equal(pinLoginError(401,{}),'That email or PIN is not correct.');
 assert.match(pinLoginError(429,{}),/wait/);
 assert.equal(pinLoginError(429,{error:'Try again after 9:00 PM.'}),'Try again after 9:00 PM.');
 assert.match(pinLoginError(400,{error:{private:'invalid'}}),/Enter your account/);
});

test('a database verification failure returns 503 without invoking Auth or failed-PIN audit',async()=>{
 const source=readFileSync(new URL('../app/api/auth/login/route.ts',import.meta.url),'utf8');
 const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const calls=[],logs=[];const exports={};
 const deps={
  '@supabase/ssr':{createServerClient(){throw Error('Must not reach Auth');}},
  'next/headers':{cookies(){throw Error('Must not set cookies');}},
  'next/server':{},
  '../../../../db/postgres-adapter':{createPostgresD1Adapter(){return{prepare(sql){calls.push(sql);return{bind(){return{first(){throw Error('Invalid portal database credential SECRET');}};}};}};}},
  '../../../lib/portal-pin-password':{},'../../../supabase-config':{},'../../../supabase-system':{},'../../../remember-device':{},
  '../../../login-response':{loginServiceUnavailable},
 };
 runInNewContext(output,{exports,require(name){assert.ok(name in deps,name);return deps[name];},Response,console:{error(...args){logs.push(args);}},process:{env:{PAYROLL_DEPARTMENT_ID:'test-department',FIREHOUSE_DATABASE_SECRET:'server-secret-fixture',PORTAL_PIN_PASSWORD_PEPPER:'fixture-pepper'}}});
 const response=await exports.POST(new Request('https://preview.example.invalid/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'member@example.invalid',pin:'1234'})}));
 assert.equal(response.status,503);assert.equal((await response.json()).error,loginServiceUnavailable);
 assert.equal(calls.length,1);assert.match(calls[0],/verify_portal_login/);
 assert.equal(response.headers.get('cache-control'),'private, no-store');
 assert.doesNotMatch(JSON.stringify(logs),/SECRET|1234|member@|server-secret/);
 assert.match(readFileSync(new URL('../app/auth-gateway.tsx',import.meta.url),'utf8'),/pinLoginError\(response.status, responsePayload\)/);
});
