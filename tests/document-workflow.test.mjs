import test from 'node:test';
import assert from 'node:assert/strict';
import { documentHarness } from './helpers/document-workflow-harness.mjs';
const content={title:'Revised local fixture',policyNumber:'1',category:'General',effectiveDate:'2026-10-05',body:'New fixture text; show safe values.',documentType:'SOP',sourceUrl:'https://example.invalid/reference.pdf'};
async function save(h,body){const response=await h.api.POST(h.request(body));assert.equal(response.status,200,await response.clone().text());return response.json();}
const draft=(revision='',id='legacy-policy')=>({id,action:'saveDraft',revision,content});
async function publish(h){const {state}=await save(h,draft());return (await save(h,{id:'legacy-policy',action:'publish',revision:state.revision,requiresAcknowledgement:true})).state;}

test('underscore IDs cannot read another document version through a LIKE wildcard',async()=>{const h=await documentHarness();try{for(const id of ['doc_one','docXone']){const saved=await save(h,draft('',id));await save(h,{id,action:'publish',revision:saved.state.revision,requiresAcknowledgement:false});}const read=await h.store.readDocumentWorkflow(h.db,'doc_one','fixture-a',true);assert.equal(read.versions.length,1);assert.equal(read.versions[0].number,1);assert.equal(read.versions[0].id,read.state.publishedVersion);}finally{await h.close();}});
test('draft save retains legacy text, creates one baseline and survives a lost response retry',async()=>{
  const h=await documentHarness();try{
    const first=await save(h,draft()),retry=await save(h,draft());assert.equal(first.state.revision,retry.state.revision);
    assert.equal((await h.pg.query('SELECT body FROM policies')).rows[0].body,'Original text; show the retained source.');
    const manager=await(await h.api.GET(h.request())).json();assert.equal(manager.versions.length,1);assert.equal(manager.versions[0].legacy,true);assert.equal(manager.versions[0].publishedAt,'');assert.equal(manager.state.draft.body,content.body);
    const member=await(await h.api.GET(h.request(null,'member'))).json();assert.equal(member.state.draft,null);assert.deepEqual(member.acknowledgementReport,[]);
    assert.equal((await h.pg.query('SELECT count(*) n FROM record_revisions')).rows[0].n,1);
  }finally{await h.close();}
});
test('publication preserves immutable versions; a required new revision needs its own acknowledgement',async()=>{
  const h=await documentHarness();try{
    const one=await publish(h);const request={id:'legacy-policy',action:'acknowledge',version:one.publishedVersion,attested:true,employeeId:'fixture-b'};
    const receipt=await(await h.api.POST(h.request(request,'member'))).json();assert.equal(receipt.acknowledgement.employeeId,'fixture-a');
    assert.equal((await(await h.api.POST(h.request(request,'member'))).json()).acknowledgement.acknowledgedAt,receipt.acknowledgement.acknowledgedAt);
    const d=await save(h,{...draft(one.revision),content:{...content,body:'Version two fixture'}});
    const two=await save(h,{id:'legacy-policy',action:'publish',revision:d.state.revision,requiresAcknowledgement:true});
    assert.notEqual(two.state.publishedVersion,one.publishedVersion);
    assert.equal((await h.api.POST(h.request(request,'member'))).status,409);
    const manager=await(await h.api.GET(h.request())).json();assert.equal(manager.versions.length,3);assert.equal(manager.versions.find(v=>v.id===one.publishedVersion).content.body,content.body);assert.equal(manager.acknowledgement,null);assert.equal(manager.acknowledgementReport.length,2);assert.ok(manager.acknowledgementReport.every(r=>r.acknowledgedAt===null));
    assert.equal(manager.historicalReports[one.publishedVersion].find(r=>r.employeeId==='fixture-a').acknowledgedAt,receipt.acknowledgement.acknowledgedAt);
    const member=await(await h.api.GET(h.request(null,'member'))).json();assert.ok(member.versions.every(v=>v.recipients.length===0));assert.equal(member.canAcknowledge,true);assert.deepEqual(member.historicalReports,{});
  }finally{await h.close();}
});
test('an audit failure rolls back draft state, legacy capture and publication together',async()=>{
  const h=await documentHarness();try{
    h.state.failAt=3;assert.equal((await h.api.POST(h.request(draft()))).status,503);
    assert.equal((await h.pg.query('SELECT count(*) n FROM system_meta')).rows[0].n,0);
    const d=await save(h,draft());h.state.failAt=3;
    assert.equal((await h.api.POST(h.request({id:'legacy-policy',action:'publish',revision:d.state.revision,requiresAcknowledgement:true}))).status,503);
    const current=await(await h.api.GET(h.request())).json();assert.equal(current.state.publishedVersion,'');assert.ok(current.state.draft);assert.equal(current.versions.length,1);
    assert.match((await h.pg.query('SELECT body FROM policies')).rows[0].body,/Original text/);
  }finally{await h.close();}
});
test('stale and concurrent drafts cannot overwrite a newer saved document',async()=>{
  const h=await documentHarness();try{
    const results=await Promise.all([h.api.POST(h.request(draft())),h.api.POST(h.request({...draft(),content:{...content,title:'Concurrent fixture'}}))]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
    assert.equal((await h.api.POST(h.request({...draft(),content:{...content,title:'Stale different fixture'}}))).status,409);
    assert.equal((await h.pg.query('SELECT count(*) n FROM record_revisions')).rows[0].n,1);
  }finally{await h.close();}
});
test('concurrent acknowledgement retries retain one receipt and original timestamp',async()=>{
  const h=await documentHarness();try{
    const state=await publish(h),payload={id:'legacy-policy',action:'acknowledge',version:state.publishedVersion,attested:true};
    const responses=await Promise.all([h.api.POST(h.request(payload,'member')),h.api.POST(h.request(payload,'member'))]);
    assert.ok(responses.every(response=>response.status===200));
    const receipts=await Promise.all(responses.map(r=>r.json()));assert.equal(receipts[0].acknowledgement.acknowledgedAt,receipts[1].acknowledgement.acknowledgedAt);
    assert.equal((await h.pg.query("SELECT count(*) n FROM system_meta WHERE key LIKE 'document-ack:%'")).rows[0].n,1);
  }finally{await h.close();}
});
test('archive/restore retains versions and receipts, including a legacy document archived before its first draft',async()=>{
  const h=await documentHarness();try{
    const a=await save(h,{id:'legacy-policy',action:'archive',revision:''});assert.equal((await h.api.GET(h.request(null,'member'))).status,404);
    const r=await save(h,{id:'legacy-policy',action:'restore',revision:a.state.revision});
    const d=await save(h,draft(r.state.revision));await save(h,{id:'legacy-policy',action:'publish',revision:d.state.revision,requiresAcknowledgement:false});
    const read=await(await h.api.GET(h.request())).json();assert.equal(read.versions.length,2);assert.match(read.versions.find(v=>v.legacy).content.body,/Original text/);
  }finally{await h.close();}
});
test('new drafts and archived documents are hidden from member resources; all department control keys are scoped',async()=>{
  const h=await documentHarness();try{
    await save(h,draft('','new-doc'));
    const library=await(await h.resources.GET(h.request(null,'member'))).json();assert.ok(!library.items.some(row=>row.id==='new-doc'));assert.ok(library.items.every(row=>row.workflow.draft===null));
    assert.equal((await h.store.documentControls(h.db)).size,1);h.setDepartment('fixture-department-b');assert.equal((await h.store.documentControls(h.db)).size,0);
  }finally{await h.close();}
});
test('unauthorized, cross-origin, unlinked and unattested actions cannot create a receipt or publish',async()=>{
  const h=await documentHarness();try{
    assert.equal((await h.api.POST(h.request(draft(),'member'))).status,403);
    assert.equal((await h.api.POST(h.request(draft(),'admin','a@example.invalid','https://evil.invalid'))).status,403);
    const state=await publish(h),payload={id:'legacy-policy',action:'acknowledge',version:state.publishedVersion,attested:true};
    assert.equal((await h.api.POST(h.request(payload,'member','unknown@example.invalid'))).status,403);
    assert.equal((await h.api.POST(h.request({...payload,attested:false},'member'))).status,400);
    assert.equal((await h.pg.query("SELECT count(*) n FROM system_meta WHERE key LIKE 'document-ack:%'")).rows[0].n,0);
  }finally{await h.close();}
});
test('invalid effective dates, unsafe references and oversized text are rejected without writes',async()=>{
  const h=await documentHarness();try{
    for(const bad of [{effectiveDate:'2026-02-30'},{sourceUrl:'javascript:alert(1)'},{sourceUrl:'https://secret:password@example.invalid/'},{body:'x'.repeat(45001)},{documentType:'Unknown'}])assert.throws(()=>h.model.normalizeDocument({...content,...bad}));
    const d=await save(h,{...draft(),content:{...content,effectiveDate:''}});assert.equal((await h.api.POST(h.request({id:'legacy-policy',action:'publish',revision:d.state.revision,requiresAcknowledgement:false}))).status,400);
    assert.match((await h.pg.query('SELECT body FROM policies')).rows[0].body,/Original text/);
  }finally{await h.close();}
});
