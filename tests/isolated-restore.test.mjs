import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { PGlite } from '@electric-sql/pglite';
import { payrollDatabaseFixture } from './helpers/payroll-submission-db.mjs';

// A real local database snapshot/restore using fictional records. This is not
// a Supabase/PITR restore, and does not exercise hosted Auth or Storage services.
test('isolated synthetic snapshot restores payroll, linked history, grants and separate file bytes into a fresh database', async t => {
  const source=await payrollDatabaseFixture();
  const directory=await mkdtemp(join(tmpdir(),'firehouse-synthetic-restore-'));
  let restored;
  try {
    await source.pg.exec(`CREATE TABLE firehouse.restore_incidents(id text PRIMARY KEY,active int,cleared_at text);
      CREATE TABLE firehouse.restore_reports(id text PRIMARY KEY,incident_id text REFERENCES firehouse.restore_incidents(id),object_key text);
      INSERT INTO firehouse.restore_incidents VALUES('synthetic-closed',0,'2026-10-16T15:00:00Z');
      INSERT INTO firehouse.restore_reports VALUES('synthetic-report','synthetic-closed','synthetic/report.txt');
      INSERT INTO firehouse.record_revisions VALUES('synthetic-revision','inspection','synthetic-report',1,'Saved','Synthetic restore evidence','synthetic-actor');`);
    const manifest=async pg=>{
      await pg.exec("SET search_path=pg_catalog");
      const tables=(await pg.query("SELECT tablename FROM pg_tables WHERE schemaname='firehouse' ORDER BY tablename")).rows;
      const rows={};
      for(const {tablename} of tables) rows[tablename]=(await pg.query(`SELECT to_jsonb(r) row FROM firehouse."${tablename}" r ORDER BY to_jsonb(r)::text`)).rows;
      return {rows,functions:(await pg.query("SELECT proname,pg_get_functiondef(oid) definition FROM pg_proc WHERE pronamespace='firehouse'::regnamespace ORDER BY proname,oid")).rows,triggers:(await pg.query("SELECT tgname,pg_get_triggerdef(oid) definition FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace='firehouse'::regnamespace) ORDER BY tgname")).rows,policies:(await pg.query("SELECT * FROM pg_policies WHERE schemaname='firehouse' ORDER BY tablename,policyname")).rows,grants:(await pg.query("SELECT table_name,grantee,privilege_type FROM information_schema.table_privileges WHERE table_schema='firehouse' ORDER BY table_name,grantee,privilege_type")).rows,constraints:(await pg.query("SELECT conrelid::regclass::text table_name,conname,pg_get_constraintdef(oid) definition FROM pg_constraint WHERE connamespace='firehouse'::regnamespace ORDER BY 1,2")).rows};
    };
    const expected=await manifest(source.pg);
    const objects=join(directory,'objects'),backup=join(directory,'object-backup'),destination=join(directory,'restored-objects');
    await mkdir(join(objects,'synthetic'),{recursive:true});
    const bytes=Buffer.from('Fictional inspection evidence; no operational or personal information.\n');
    await writeFile(join(objects,'synthetic/report.txt'),bytes);
    await cp(objects,backup,{recursive:true});
    const snapshot=await source.pg.dumpDataDir();
    await writeFile(join(directory,'synthetic-snapshot.tar.gz'),Buffer.from(await snapshot.arrayBuffer()));
    await source.pg.exec("DELETE FROM firehouse.restore_reports; UPDATE firehouse.restore_incidents SET active=1,cleared_at=NULL; UPDATE firehouse.time_entries SET hours=0;");
    await rm(objects,{recursive:true});
    const started=performance.now();
    restored=new PGlite({loadDataDir:new Blob([await readFile(join(directory,'synthetic-snapshot.tar.gz'))])});
    await restored.waitReady;
    await cp(backup,destination,{recursive:true});
    assert.deepEqual(await manifest(restored),expected);
    const recovered=await readFile(join(destination,'synthetic/report.txt'));
    assert.equal(createHash('sha256').update(recovered).digest('hex'),createHash('sha256').update(bytes).digest('hex'));
    assert.equal((await restored.query('SELECT active FROM firehouse.restore_incidents')).rows[0].active,0);
    assert.equal((await restored.query('SELECT count(*) n FROM firehouse.restore_reports r JOIN firehouse.restore_incidents i ON i.id=r.incident_id')).rows[0].n,1);
    for(const role of ['anon','authenticated']) {
      await restored.exec(`SET ROLE ${role}`);
      await assert.rejects(restored.query('SELECT * FROM firehouse.time_entries'),/permission denied/);
      await restored.exec('RESET ROLE');
    }
    t.diagnostic(JSON.stringify({kind:'synthetic-local-PGlite-restore',tables:Object.keys(expected.rows).length,objectBytesVerified:bytes.length,restoredClosedIncident:true,deniedRoles:['anon','authenticated'],elapsedMs:Math.round(performance.now()-started),productionBackupVerified:false}));
  } finally { if(restored)await restored.close();await source.pg.close();await rm(directory,{recursive:true,force:true}); }
});
