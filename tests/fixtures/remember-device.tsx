import React from 'react';
import {createRoot} from 'react-dom/client';
import AuthGateway from '../../app/auth-gateway';
import '../../app/globals.css';
import '../../app/mobile-usability.css';
import '../../app/portal-usability.css';
const params=new URLSearchParams(location.search);
if(params.has('reset')){sessionStorage.clear();history.replaceState(null,'',location.pathname);}
if(params.has('pin')){sessionStorage.setItem('remember-fixture-signed','1');sessionStorage.removeItem('remember-fixture-deadline');}
const errors:string[]=[],requests:{url:string;method:string;rememberDevice?:unknown}[]=[];
window.addEventListener('error',event=>errors.push(event.message));
window.addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
Object.assign(window,{rememberAudit:{errors,requests}});
window.fetch=async(input,init)=>{
  const url=typeof input==='string'?input:input instanceof URL?input.pathname:input.url;
  const method=init?.method||'GET',body=JSON.parse(String(init?.body||'{}'));
  requests.push({url,method,rememberDevice:body.rememberDevice});
  const deadline=Number(sessionStorage.getItem('remember-fixture-deadline')||0);
  if(url==='/api/auth/context') return Response.json({pinConfigured:true,pinUnlocked:deadline>Date.now()});
  if(url==='/api/auth/login'||(url==='/api/auth/pin'&&method==='POST')) {
    if(body.pin!=='1234')return Response.json({error:'That PIN is not correct. Fictional test only.'},{status:401});
    sessionStorage.setItem('remember-fixture-signed','1');
    sessionStorage.setItem('remember-fixture-deadline',String(Date.now()+(body.rememberDevice===true?604800000:1800000)));
    sessionStorage.setItem('remember-fixture-enabled',String(body.rememberDevice===true));
    return Response.json({ok:true});
  }
  if(url==='/api/auth/pin'&&method==='PATCH') {
    if(deadline<=Date.now())return Response.json({error:'Enter your portal PIN to continue.'},{status:423});
    return Response.json(sessionStorage.getItem('remember-fixture-enabled')==='true'
      ?{ok:true,rememberedUntil:new Date(deadline).toISOString(),serverNow:new Date().toISOString()}:{ok:true});
  }
  if(url==='/api/auth/pin'&&method==='DELETE'){sessionStorage.removeItem('remember-fixture-deadline');return Response.json({ok:true});}
  errors.push(`Unexpected fixture API: ${method} ${url}`);return Response.json({error:'Unexpected fixture request'},{status:500});
};
createRoot(document.getElementById('root')!).render(<><div style={{background:'#ffecb5',padding:6,textAlign:'center'}}>Fictional local sign-in test — no real records</div><AuthGateway /></>);
