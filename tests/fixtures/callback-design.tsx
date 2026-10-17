import React from 'react';
import {createRoot} from 'react-dom/client';
import CallbackReviews from '../../app/callback-reviews';
import '../../app/globals.css';
import '../../app/mobile-usability.css';
import '../../app/portal-usability.css';
const row={id:'synthetic-one',logDate:'2026-10-16',reportNumber:'DEMO-2026-001',callType:'Mutual aid — extended incident response',callTimeOut:'18:15',callTimeIn:'20:30',status:'pending',submittedAt:'2026-10-16T21:00:00Z',employeeName:'Alexandra Example-Montgomery',employeeRank:'Deputy Chief',reviewerName:'Jordan Example',submittedBy:'Synthetic officer',submittedByRank:'Captain',matches:['Weekend window qualifies for callback review.'],flags:['Member was already on duty at dispatch. Confirm that the callback does not duplicate recorded shift hours.'],suggestedHours:2.25,approvedHours:0,actualMinutes:135};
let submissions=[row,{...row,id:'synthetic-two',employeeName:'Morgan Example',status:'approved',flags:[],approvedHours:2.25,reviewNote:'Synthetic approval for preview only.'}];
(window as unknown as {previewRequests:unknown[]}).previewRequests=[];
window.fetch=async(input,init)=>{
 if(String(input)!=='/api/callbacks?scope=review'&&String(input)!=='/api/callbacks')throw new Error('External request blocked');
 if(init?.method==='POST'){const body=JSON.parse(String(init.body));(window as unknown as {previewRequests:unknown[]}).previewRequests.push(body);if(body.action==='review')submissions=submissions.map(s=>s.id===body.id?{...s,status:body.status,approvedHours:body.approvedHours??0,reviewNote:body.reviewNote}:s);}
 return new Response(JSON.stringify({submissions,reviewers:[{id:'synthetic-reviewer',name:'Jordan Example',rank:'Captain'}],setting:{reviewerEmployeeId:'synthetic-reviewer'}}),{headers:{'content-type':'application/json'}});
};
createRoot(document.getElementById('root')!).render(<main style={{padding:16,maxWidth:1160,margin:'auto'}}><aside style={{marginBottom:16,color:'#17324d',background:'#fff4c2',padding:12}}>Synthetic preview · no department records or payroll writes</aside><CallbackReviews/></main>);
