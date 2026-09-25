import React from 'react';
import {createRoot} from 'react-dom/client';
import AuthGateway from '../../app/auth-gateway';
import {audit,emitRecoveryEvent} from './auth-recovery-client';
import '../../app/globals.css';
window.fetch=async(input)=>{
  if(String(input)==='/api/auth/context')return Response.json(audit.context===200?{pinConfigured:true,pinUnlocked:true}:{error:'Fictional access failure'},{status:audit.context});
  return Response.json({ok:true});
};
window.addEventListener('error',event=>audit.errors.push(event.message));
window.addEventListener('unhandledrejection',event=>audit.errors.push(String(event.reason)));
createRoot(document.getElementById('root')!).render(<><p>Fictional authentication boundary audit · No production session</p>
  <button onClick={()=>{audit.identity='verified';audit.context=200;emitRecoveryEvent();}}>Verify fictional account</button>
  <button onClick={()=>emitRecoveryEvent()}>Repeat sign-in refresh</button>
  <button onClick={()=>{audit.context=403;emitRecoveryEvent();}}>Revoke fictional access</button>
  <AuthGateway/></>);
