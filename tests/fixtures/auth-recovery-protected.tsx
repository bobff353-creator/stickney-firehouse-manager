import React, {useState} from 'react';
// Only the gate is under test here. Tool data and idle locking have separate tests.
export default function ProtectedFixture({children}:{children?:React.ReactNode}){
  const [draft,setDraft]=useState('');
  return children??<div id="protected-fixture">Verified fictional tool boundary<label>Fictional unsaved training notes<input value={draft} onChange={event=>setDraft(event.target.value)}/></label></div>;
}
