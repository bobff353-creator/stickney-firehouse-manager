import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const quote = value => `'${value.replaceAll("'", "''")}'`;

export function buildRestoreMigration(catalog, orderedTables) {
  const allowedSchemas = new Set(['public', 'firehouse']);
  if (catalog.source_project !== 'datqzdndkrfyovhwppuq' || new Set(orderedTables).size !== orderedTables.length) throw Error('A verified source and unique restore order are required.');
  const tables = orderedTables.map(key => {
    const [schema, name] = key.split('.');
    if (!allowedSchemas.has(schema) || !catalog.relations.some(t => t.schema === schema && t.name === name && t.kind === 'r')) throw Error('Unrecognized restore table.');
    const primary = catalog.constraints.find(c => c.schema === schema && c.table === name && c.type === 'p');
    const primaryKey = primary ? primary.definition.match(/^PRIMARY KEY \(([^)]+)\)/)[1].split(',').map(s => s.trim().replaceAll('"', '')) : [];
    const columns = catalog.columns.filter(c => c.schema === schema && c.table === name).sort((a, b) => a.position - b.position).map(c => c.name);
    const triggers = catalog.triggers.filter(t => t.schema === schema && t.table === name).map(t => ({ name: t.name, enabled: t.enabled }));
    return { schema, name, primaryKey, columns, triggers };
  });
  const plan = quote(JSON.stringify(tables));
  return `
CREATE TABLE private.review_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_project text NOT NULL CHECK (source_project='datqzdndkrfyovhwppuq'),
  target_project text NOT NULL CHECK (target_project='qizfnynrspsydiuwkkex'),
  cipher_sha256 text NOT NULL UNIQUE CHECK (cipher_sha256 ~ '^[a-f0-9]{64}$'),
  byte_size bigint NOT NULL CHECK (byte_size>0),
  parts integer NOT NULL CHECK (parts>0),
  status text NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading','complete')),
  created_at timestamptz NOT NULL DEFAULT now(),
  restored_at timestamptz,
  verification jsonb
);
CREATE TABLE private.review_import_chunks (
  run_id uuid NOT NULL REFERENCES private.review_import_runs(id),
  part_number integer NOT NULL CHECK (part_number>=0),
  data bytea NOT NULL,
  PRIMARY KEY(run_id,part_number)
);
ALTER TABLE private.review_import_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.review_import_chunks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.review_import_runs,private.review_import_chunks FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION private.restore_review_snapshot(p_run uuid,p_passphrase text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET timezone='UTC' AS $restore$
DECLARE
  run private.review_import_runs%ROWTYPE;
  cipher bytea;
  snapshot jsonb;
  plan jsonb := ${plan}::jsonb;
  item jsonb;
  payload jsonb;
  identity_record jsonb;
  trigger_record jsonb;
  rows_json text;
  statement text;
  conflict_clause text;
  key_columns text;
  changed_columns text;
  actual_count bigint;
  actual_hash text;
  table_verification jsonb := '[]'::jsonb;
  enable_command text;
BEGIN
  SELECT * INTO STRICT run FROM private.review_import_runs WHERE id=p_run FOR UPDATE;
  IF run.status='complete' THEN RETURN run.verification; END IF;
  IF run.target_project<>'qizfnynrspsydiuwkkex' OR p_passphrase IS NULL OR length(p_passphrase)<64 THEN RAISE EXCEPTION 'Independent review restore configuration required'; END IF;
  IF EXISTS(SELECT 1 FROM public.portal_pin_credentials) THEN RAISE EXCEPTION 'Restore must finish before member PIN activation'; END IF;
  IF (SELECT count(*) FROM private.review_import_chunks WHERE run_id=p_run)<>run.parts
    OR (SELECT min(part_number) FROM private.review_import_chunks WHERE run_id=p_run)<>0
    OR (SELECT max(part_number) FROM private.review_import_chunks WHERE run_id=p_run)<>run.parts-1 THEN RAISE EXCEPTION 'Snapshot chunks are incomplete'; END IF;
  SELECT string_agg(data,''::bytea ORDER BY part_number) INTO cipher FROM private.review_import_chunks WHERE run_id=p_run;
  IF octet_length(cipher)<>run.byte_size OR encode(extensions.digest(cipher,'sha256'),'hex')<>run.cipher_sha256 THEN RAISE EXCEPTION 'Snapshot integrity check failed'; END IF;
  snapshot := extensions.pgp_sym_decrypt(cipher,p_passphrase)::jsonb;
  IF snapshot->>'source_project'<>run.source_project OR (SELECT count(*) FROM jsonb_object_keys(snapshot->'tables'))<>jsonb_array_length(plan) THEN RAISE EXCEPTION 'Snapshot source or table plan does not match'; END IF;
  FOR identity_record IN SELECT value FROM jsonb_array_elements(snapshot->'identities') LOOP
    IF NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=(identity_record->>'id')::uuid AND lower(u.email)=lower(identity_record->>'email')) THEN RAISE EXCEPTION 'A historical identity must be provisioned before restore'; END IF;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(plan) LOOP
    payload := snapshot->'tables'->((item->>'schema')||'.'||(item->>'name'));
    IF payload IS NULL OR jsonb_typeof(payload->'rows')<>'array' OR jsonb_array_length(payload->'rows')<>(payload->>'count')::bigint THEN RAISE EXCEPTION 'Invalid snapshot table %',item->>'name'; END IF;
    SELECT '['||coalesce(string_agg(value,',' ORDER BY ord),'')||']' INTO rows_json FROM jsonb_array_elements_text(payload->'rows') WITH ORDINALITY AS row_values(value,ord);
    conflict_clause := '';
    IF jsonb_array_length(item->'primaryKey')>0 THEN
      SELECT string_agg(format('%I',value),',') INTO key_columns FROM jsonb_array_elements_text(item->'primaryKey');
      SELECT string_agg(format('%I=excluded.%I',value,value),',') INTO changed_columns FROM jsonb_array_elements_text(item->'columns') WHERE NOT (item->'primaryKey') ? value;
      conflict_clause := format(' ON CONFLICT (%s) DO ',key_columns)||CASE WHEN changed_columns IS NULL THEN 'NOTHING' ELSE 'UPDATE SET '||changed_columns END;
    ELSE
      EXECUTE format('SELECT count(*) FROM %I.%I',item->>'schema',item->>'name') INTO actual_count;
      IF actual_count<>0 THEN RAISE EXCEPTION 'A table without a primary key must be empty before restore: %',item->>'name'; END IF;
    END IF;
    -- Suspend application notifications/audit writers only inside this atomic
    -- restore. PostgreSQL foreign-key constraints and RLS remain in place.
    EXECUTE format('ALTER TABLE %I.%I DISABLE TRIGGER USER',item->>'schema',item->>'name');
    statement := format('INSERT INTO %I.%I SELECT * FROM jsonb_populate_recordset(NULL::%I.%I,%L::jsonb)',item->>'schema',item->>'name',item->>'schema',item->>'name',rows_json)||conflict_clause;
    EXECUTE statement;
    FOR trigger_record IN SELECT value FROM jsonb_array_elements(item->'triggers') LOOP
      enable_command := CASE trigger_record->>'enabled' WHEN 'O' THEN 'ENABLE' WHEN 'D' THEN 'DISABLE' WHEN 'R' THEN 'ENABLE REPLICA' WHEN 'A' THEN 'ENABLE ALWAYS' ELSE NULL END;
      IF enable_command IS NULL THEN RAISE EXCEPTION 'Unrecognized source trigger state'; END IF;
      EXECUTE format('ALTER TABLE %I.%I %s TRIGGER %I',item->>'schema',item->>'name',enable_command,trigger_record->>'name');
    END LOOP;
    EXECUTE format('SELECT count(*),encode(extensions.digest(coalesce(string_agg(row_json,E''\\n'' ORDER BY row_json),''''),''sha256''),''hex'') FROM (SELECT to_jsonb(t)::text AS row_json FROM %I.%I t) actual_rows',item->>'schema',item->>'name') INTO actual_count,actual_hash;
    IF actual_count<>(payload->>'count')::bigint OR actual_hash<>payload->>'sha256' THEN RAISE EXCEPTION 'Restored count or hash differs for %.%',item->>'schema',item->>'name'; END IF;
    table_verification := table_verification||jsonb_build_array(jsonb_build_object('table',(item->>'schema')||'.'||(item->>'name'),'rows',actual_count::text,'sha256',actual_hash));
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_namespace n ON n.oid=c.connamespace WHERE n.nspname IN ('public','firehouse') AND NOT c.convalidated) THEN RAISE EXCEPTION 'An unvalidated constraint remains'; END IF;
  UPDATE private.review_import_runs SET status='complete',restored_at=now(),verification=jsonb_build_object('captured_at',snapshot->>'captured_at','tables',table_verification,'foreign_keys','enforced throughout restore') WHERE id=p_run;
  RETURN (SELECT r.verification FROM private.review_import_runs r WHERE r.id=p_run);
END;
$restore$;
REVOKE ALL ON FUNCTION private.restore_review_snapshot(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [catalogPath, orderPath, outputPath] = process.argv.slice(2);
  const sql = buildRestoreMigration(JSON.parse(readFileSync(catalogPath,'utf8')),JSON.parse(readFileSync(orderPath,'utf8')));
  writeFileSync(outputPath,sql);
  console.log(JSON.stringify({migration:outputPath,bytes:Buffer.byteLength(sql)}));
}
