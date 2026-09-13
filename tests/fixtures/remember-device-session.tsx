import React from 'react';
// Local test adapter only. Never imported by the production application.
const user={id:'fictional-member',email:'member@example.test'};
export function getSupabaseBrowserClient() {
  return {auth:{
    getUser:async()=>({data:{user:sessionStorage.getItem('remember-fixture-signed')?user:null},error:null}),
    onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
    signOut:async()=>{sessionStorage.removeItem('remember-fixture-signed');sessionStorage.removeItem('remember-fixture-deadline');return {error:null};},
  }};
}
export default function FixturePortal({onSignOut}:{onSignOut:()=>Promise<void>}) {
  return <main className="content-card"><h1>Fictional portal workspace</h1>
    <p>Local browser test only. No department records or real credentials.</p>
    <label>Unfinished work<input aria-label="Unfinished work" defaultValue="Keep this draft" /></label>
    <button id="fixture-pin-check" onClick={()=>window.dispatchEvent(new Event('firehouse:session-lock'))}>Simulate required PIN check</button>
    <button id="fixture-sign-out" onClick={()=>void onSignOut()}>Sign out</button>
  </main>;
}
