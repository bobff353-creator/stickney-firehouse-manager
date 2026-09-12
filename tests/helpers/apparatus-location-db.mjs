import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
export const department='14a76771-4c24-481b-8def-e6cce005c17b',user='00000000-0000-4000-8000-000000000001',otherUser='00000000-0000-4000-8000-000000000002';
export async function locationTestDatabase(){
 const pg=new PGlite();
 await pg.exec(`CREATE SCHEMA firehouse;CREATE SCHEMA auth;CREATE SCHEMA realtime;
 CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
 CREATE TABLE public.departments(id uuid primary key);INSERT INTO public.departments VALUES('${department}');
 CREATE TABLE auth.users(id uuid primary key);INSERT INTO auth.users VALUES('${user}'),('${otherUser}');
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.user',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth,realtime,firehouse TO authenticated;
 CREATE TABLE firehouse.fleet_apparatus(id text primary key,unit_number text,name text,status text,retired_at text);
 INSERT INTO firehouse.fleet_apparatus VALUES('test-engine','TEST E','Fictional test engine','in_service',null),('test-car','TEST C','Fictional test car','in_service',null);
 CREATE TABLE realtime.messages(id bigint generated always as identity,topic text,event text,payload jsonb,extension text,private boolean DEFAULT true,inserted_at timestamp DEFAULT now());
 CREATE INDEX messages_inserted_at_topic_index ON realtime.messages(inserted_at DESC,topic) WHERE extension='broadcast' AND private IS TRUE;
 ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;GRANT SELECT,INSERT ON realtime.messages TO authenticated;
 CREATE FUNCTION realtime.topic() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.topic',true) $$;
 CREATE FUNCTION realtime.send(payload jsonb,event text,topic text,is_private boolean DEFAULT true) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 IF current_setting('test.fail_broadcast',true)='true' THEN RETURN; END IF;
 INSERT INTO realtime.messages(payload,event,topic,extension) VALUES(payload,event,topic,'broadcast'); END $$;`);
 await pg.exec(readFileSync(new URL('../../supabase/migrations/20260912164513_apparatus_location_tracking.sql',import.meta.url),'utf8'));
 return pg;
}
export async function pairTestDevice(pg,hash='a'.repeat(64),apparatus='test-engine'){
 return (await pg.query(`INSERT INTO firehouse.apparatus_trackers(department_id,apparatus_id,token_hash,device_name,sender_kind,paired_by) VALUES($1,$2,$3,'Fixture mounted device','browser','fixture@example.invalid') RETURNING device_id`,[department,apparatus,hash])).rows[0].device_id;
}
export const encodeFix=fix=>Buffer.from(JSON.stringify(fix)).toString('base64');
export async function ingestTestFix(pg,fix,now=new Date().toISOString(),hash='a'.repeat(64)){
 return (await pg.query('SELECT firehouse.ingest_apparatus_location($1,$2,$3) result',[hash,encodeFix(fix),now])).rows[0].result;
}
