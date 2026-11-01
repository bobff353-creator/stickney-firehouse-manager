import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const cleanup=await readFile(new URL('../scripts/sql/weekly-mechanical-template-cleanup.sql',import.meta.url),'utf8');
const dept='14a76771-4c24-481b-8def-e6cce005c17b';
const other='00000000-0000-4000-8000-000000000099';
const rigs=['1201','1203','1204','1205','1207','1208','1209','1210','1211','Div 11 Light Trailer'];
const reviewed=[['1203','frontline-251-',103,113],['1204','form-439-',38,48],['1204','form-439-',51,65],['1204','form-439-',68,113],['1204','form-439-',116,166],['1211','form-466-',22,32],['Div 11 Light Trailer','form-393-',8,25]];
async function setup(t){
 const pg=new PGlite();t.after(()=>pg.close());
 await pg.exec(`CREATE TABLE departments(id uuid PRIMARY KEY,name text);
 CREATE TABLE inventory_apparatus_profiles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),department_id uuid,name text);
 CREATE TABLE inventory_compartments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),department_id uuid,apparatus_id uuid,label text);
 CREATE TABLE inventory_equipment(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),department_id uuid,apparatus_id uuid,compartment_id uuid,name text,check_types text[],source_key text,meter_template text,meter_template_version int DEFAULT 0,retired_at timestamptz,updated_at timestamptz DEFAULT '2026-01-01',quantity_required int DEFAULT 1,source_form text DEFAULT 'Original source evidence',purchase_date date DEFAULT '2025-04-15',barcode text DEFAULT 'Original asset barcode');
 CREATE TABLE inventory_checks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),department_id uuid,apparatus_id uuid,check_type text,status text);
 CREATE TABLE inventory_check_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),department_id uuid,check_id uuid,equipment_id uuid,result text,notes text);
 CREATE TABLE inventory_inspection_schedules(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),apparatus_id uuid,check_type text,day_of_week int,start_time time,end_time time);
 INSERT INTO departments VALUES('${dept}','Stickney Fire Department'),('${other}','Other department');`);
 const locations=new Map();
 for(const department of [dept,other])for(const rig of rigs){
  const profile=(await pg.query('INSERT INTO inventory_apparatus_profiles(department_id,name) VALUES($1,$2) RETURNING id',[department,rig])).rows[0].id;
  for(const label of ['Vehicle','Cab','Inventory']){
   const compartment=(await pg.query('INSERT INTO inventory_compartments(department_id,apparatus_id,label) VALUES($1,$2,$3) RETURNING id',[department,profile,label])).rows[0].id;
   locations.set(`${department}/${rig}/${label}`,{rig:profile,compartment});
  }
  await pg.query("INSERT INTO inventory_inspection_schedules(apparatus_id,check_type,day_of_week,start_time,end_time) VALUES($1,'weekly',6,'12:00','18:00')",[profile]);
 }
 async function add(department,rig,source,tags,name,extra={}){
  const where=locations.get(`${department}/${rig}/${extra.location||'Cab'}`);
  return (await pg.query('INSERT INTO inventory_equipment(department_id,apparatus_id,compartment_id,name,check_types,source_key,meter_template,meter_template_version,retired_at,quantity_required) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',[department,where.rig,where.compartment,name,tags,source,extra.meter||null,extra.meter?3:0,extra.retired?'2026-01-01':null,extra.quantity||1])).rows[0];
 }
 const targets=[];
 for(const [rig,prefix,first,last] of reviewed)for(let n=first;n<=last;n++){
  const key=prefix+String(n).padStart(3,'0');
  const tags=rig==='Div 11 Light Trailer'?['weekly']:rig==='1211'&&n===28?['air_pack','weekly']:rig==='1203'?['weekly','inventory','air_pack']:['inventory','weekly','daily'];
  const item=await add(dept,rig,key,tags,'Fixture carried equipment',{location:rig==='Div 11 Light Trailer'?'Inventory':'Cab',quantity:n%3+1});targets.push(item.id);
  await add(other,rig,key,tags,'Other department original equipment',{location:rig==='Div 11 Light Trailer'?'Inventory':'Cab'});
 }
 // Mechanical/functional tasks from the reviewed lists, including gaps between gear ranges.
 for(const rig of rigs)await add(dept,rig,'mechanical-body',['weekly'],'Inspect body and mechanical condition',{location:'Vehicle'});
 for(const source of ['form-439-001','form-439-049','form-439-050','form-439-066','form-439-067','form-439-114','form-439-115'])await add(dept,'1204',source,['weekly'],'Pump controls, functional power-tool testing or saw servicing');
 for(let n=1;n<=7;n++)await add(dept,'Div 11 Light Trailer','form-393-'+String(n).padStart(3,'0'),['weekly'],n===7?'Run for 20 minutes on first and third Saturdays':'Trailer mechanical inspection',{location:'Vehicle'});
 for(const [rig,source] of [['1203','frontline-251-023'],['1204','form-439-023']])await add(dept,rig,source,['inventory','weekly'],'5 gas meter',{meter:JSON.stringify({version:1,title:'Original editable weekly meter inspection',instructions:'Original functional inspection instructions'})});
 await add(dept,'1205','form-466-022',['inventory'],'Same source on a different apparatus');
 await add(dept,'1204','retired-stock',['weekly','inventory'],'Retired equipment',{retired:true});
 const rig=locations.get(`${dept}/1203/Cab`).rig;
 for(const [kind,status,result] of [['weekly','in_progress','pending'],['weekly','completed','pass'],['daily','in_progress','pending']]){
  const inspection=(await pg.query('INSERT INTO inventory_checks(department_id,apparatus_id,check_type,status) VALUES($1,$2,$3,$4) RETURNING id',[dept,rig,kind,status])).rows[0].id;
  await pg.query('INSERT INTO inventory_check_items(department_id,check_id,equipment_id,result,notes) VALUES($1,$2,$3,$4,$5)',[dept,inspection,targets[0],result,'Original saved observation and source date']);
 }
 return {pg,targets,add};
}
async function records(pg,table){return(await pg.query(`SELECT * FROM ${table} ORDER BY id`)).rows;}
async function history(pg){return{checks:await records(pg,'inventory_checks'),items:await records(pg,'inventory_check_items'),schedules:await records(pg,'inventory_inspection_schedules')};}

test('reviewed cleanup removes only weekly gear assignments; preserves IDs, quantities, dates, original results, schedules and both meter forms',async t=>{
 const {pg,targets}=await setup(t),before=await records(pg,'inventory_equipment'),saved=await history(pg);
 await pg.exec(cleanup);const after=await records(pg,'inventory_equipment');assert.equal(after.length,before.length);
 let changed=0,trailerInventory=0;
 for(let i=0;i<before.length;i++){
  const original=before[i],current=after[i];
  if(targets.includes(original.id)){
   changed++;const expected=original.check_types.filter(type=>type!=='weekly');if(!expected.includes('inventory'))expected.push('inventory');
   assert.deepEqual(current.check_types,expected);
   assert.deepEqual({...current,check_types:original.check_types,updated_at:original.updated_at},original);
   if(original.source_key.startsWith('form-393-'))trailerInventory++;
  }else assert.deepEqual(current,original,'unrelated equipment and functional meter forms remain unchanged');
 }
 assert.equal(changed,163);assert.equal(trailerInventory,18);assert.deepEqual(await history(pg),saved);
 assert.deepEqual(after.find(row=>row.department_id===dept&&row.source_key==='form-466-028').check_types,['air_pack','inventory'],'1211 Driver SCBA remains available in Inventory without changing its separate Air Pack assignment');
 assert.equal((await pg.query("SELECT count(*)::int n FROM inventory_equipment WHERE department_id=$1 AND meter_template IS NOT NULL AND 'weekly'=ANY(check_types)",[dept])).rows[0].n,2);
 await pg.exec(cleanup);assert.deepEqual(await records(pg,'inventory_equipment'),after,'reapplying the correction is a no-op');assert.deepEqual(await history(pg),saved);
});

test('a partially changed reviewed set aborts the entire correction without overwriting department edits',async t=>{
 const {pg,targets}=await setup(t);await pg.query("UPDATE inventory_equipment SET check_types=ARRAY['inventory'] WHERE id=$1",[targets[0]]);
 const before=await records(pg,'inventory_equipment'),saved=await history(pg);
 await assert.rejects(pg.exec(cleanup),/expected 11 or 0 rows; got 10/);await pg.exec('ROLLBACK');
 assert.deepEqual(await records(pg,'inventory_equipment'),before);assert.deepEqual(await history(pg),saved);
});

test('an unexpected inventory assignment on any other apparatus stops and rolls back all reviewed changes',async t=>{
 const {pg,add}=await setup(t);await add(dept,'1208','unreviewed-stock',['weekly','inventory'],'New unreviewed stock count');
 const before=await records(pg,'inventory_equipment'),saved=await history(pg);
 await assert.rejects(pg.exec(cleanup),/unreviewed inventory entry remains/);await pg.exec('ROLLBACK');
 assert.deepEqual(await records(pg,'inventory_equipment'),before);assert.deepEqual(await history(pg),saved);
});
