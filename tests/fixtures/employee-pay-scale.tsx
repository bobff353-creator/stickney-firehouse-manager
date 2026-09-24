import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import EmployeePayScale from '../../app/employee-pay-scale';
import '../../app/globals.css';
import '../../app/portal-usability.css';

window.fetch = async () => { throw new Error('All application requests blocked in fictional preview'); };
function Preview() {
  const [value, setValue] = useState('sample-b'), [dirty, setDirty] = useState(false), [canManage, setCanManage] = useState(true), [canChange, setCanChange] = useState(true), [message, setMessage] = useState('');
  return <main style={{ padding: 16, maxWidth: 1000, margin: 'auto' }}>
    <aside style={{ padding: 12, background: '#fff4c2', color: '#17324d' }}><strong>Fictional preview · no employee, rate, or permission changes</strong><label style={{display:'block'}}><input type="checkbox" checked={canManage} onChange={e=>setCanManage(e.target.checked)} />Payroll management access</label><label style={{display:'block'}}><input type="checkbox" checked={canChange} onChange={e=>setCanChange(e.target.checked)} />Manage permissions access</label></aside>
    <div className="employee-profile-form"><fieldset><legend>Employment</legend><div className="employee-fields three-col">
      <label>Last name<input value="Example" readOnly /></label><label>First name<input value="Member" readOnly /></label>
      <EmployeePayScale scales={[{id:'sample-a',label:'Deputy Chief',regularRate:36.40},{id:'sample-b',label:'Deputy Chief',regularRate:29.72}]} value={value} period="September 11–25, 2026" canChangeScale={canChange} canManageRates={canManage} employeeDirty={dirty} onChange={id=>{setValue(id);setDirty(true);}} onEditRates={()=>setMessage(`Opening shared rates for ${value}`)} />
    </div><button type="button" onClick={()=>{setDirty(false);setMessage('Fictional employee selection confirmed');}}>Save employee (fictional)</button><p role="status">{message}</p></fieldset></div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
