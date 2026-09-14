import React from 'react';
// Only the gate is under test here. Tool data and idle locking have separate tests.
export default function ProtectedFixture({children}:{children?:React.ReactNode}){return children??<div id="protected-fixture">Verified fictional tool boundary</div>;}
