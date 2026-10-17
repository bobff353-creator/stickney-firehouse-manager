import React from 'react';
import {createRoot} from 'react-dom/client';
import WorkDetails from '../../app/work-details';
import '../../app/globals.css';
import '../../app/mobile-usability.css';
if(!['127.0.0.1','localhost'].includes(location.hostname))throw Error('Synthetic localhost fixture only');
window.fetch=async input=>{
 if(String(input)!=='/api/work-details')throw Error('Unexpected request blocked');
 const member={id:'synthetic',name:'Synthetic Member',rank:'Captain'};
 return Response.json({viewer:{employeeId:member.id,isAdmin:true},employees:[member],officers:[member],approvers:[member],requests:[]});
};
createRoot(document.getElementById('root')!).render(<main style={{padding:12,maxWidth:1100,margin:'auto'}}><p>Synthetic local elapsed-time verification. No operational writes.</p><WorkDetails/></main>);
