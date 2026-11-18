import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const schemas = new Set(['public', 'firehouse', 'private', 'department_gateway']);
const sourceProjects = new Set(['ukpdacqjmhvlhmrwxtcx', 'datqzdndkrfyovhwppuq']);
const identifier = value => `"${String(value).replaceAll('"', '""')}"`;
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const qualified = (schema, name) => `${identifier(schema)}.${identifier(name)}`;
const objectKey = value => `${value.schema}.${value.name}`;
const role = value => value === 'PUBLIC' ? 'PUBLIC' : identifier(value);
const knownRoles = new Set(['PUBLIC', 'postgres', 'pg_database_owner', 'anon', 'authenticated', 'service_role']);
const privileges = new Set(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN', 'USAGE', 'CREATE', 'EXECUTE']);
function integer(value) {
  if (typeof value !== 'string' || !/^-?\d+$/.test(value)) throw new Error('Sequence values must be exact decimal strings.');
  return value;
}

// Produce a schema-only plan. This module never connects to or changes a database.
// The caller must validate the plan before applying it to the explicit new project.
export function buildSchemaPlan(catalog, extras, dependencies, targetProject, proofHash) {
  if (!sourceProjects.has(catalog.source_project)) throw new Error('Unrecognized schema source.');
  if (!/^[a-z]{20}$/.test(targetProject) || sourceProjects.has(targetProject)) throw new Error('An independent target project is required.');
  if (!/^[a-f0-9]{64}$/.test(proofHash)) throw new Error('A fresh server proof hash is required.');
  if (catalog.domains?.length || dependencies.custom_event_triggers?.length || dependencies.view_dependencies?.length) {
    throw new Error('Additional domain, event-trigger, or view-dependency review is required.');
  }
  if (catalog.columns.some(column => column.generated || column.acl)) throw new Error('Generated columns or column grants require explicit review.');
  for (const item of [...catalog.relations, ...catalog.functions]) {
    if (!schemas.has(item.schema) || item.owner !== 'postgres') throw new Error('Unexpected object schema or owner.');
  }
  // The catalog was read using PostgreSQL's normal public search path, so its
  // type/default/constraint renderings may intentionally omit that schema.
  const sql = ['BEGIN;', "SET LOCAL check_function_bodies = off;", 'SET LOCAL search_path = public;', 'CREATE SCHEMA IF NOT EXISTS extensions;'];
  for (const extension of catalog.extensions) {
    if (extension.name === 'pgcrypto' || extension.name === 'uuid-ossp') {
      sql.push(`CREATE EXTENSION IF NOT EXISTS ${identifier(extension.name)} WITH SCHEMA ${identifier(extension.schema)};`);
    }
  }
  for (const schema of catalog.schemas) sql.push(`CREATE SCHEMA IF NOT EXISTS ${identifier(schema.name)};`);
  const enumGroups = Map.groupBy(catalog.enums ?? [], objectKey);
  for (const values of enumGroups.values()) {
    values.sort((a, b) => a.position - b.position);
    sql.push(`CREATE TYPE ${qualified(values[0].schema, values[0].name)} AS ENUM (${values.map(value => literal(value.label)).join(', ')});`);
  }
  const sequenceByColumn = new Map((extras.sequences ?? []).map(sequence => [`${sequence.owned_schema}.${sequence.owned_table}.${sequence.owned_column}`, sequence]));
  const columnsByTable = Map.groupBy(catalog.columns, column => `${column.schema}.${column.table}`);
  for (const table of catalog.relations.filter(relation => relation.kind === 'r')) {
    const columns = columnsByTable.get(`${table.schema}.${table.name}`);
    if (!columns?.length) throw new Error(`Missing columns for ${objectKey(table)}.`);
    const definitions = columns.sort((a, b) => a.position - b.position).map(column => {
      let definition = `${identifier(column.name)} ${column.type}`;
      if (column.identity) {
        const sequence = sequenceByColumn.get(`${column.schema}.${column.table}.${column.name}`);
        if (!sequence || !['a', 'd'].includes(column.identity)) throw new Error('Identity sequence metadata is incomplete.');
        definition += ` GENERATED ${column.identity === 'a' ? 'ALWAYS' : 'BY DEFAULT'} AS IDENTITY (SEQUENCE NAME ${qualified(sequence.schema, sequence.name)} START WITH ${integer(sequence.start)} INCREMENT BY ${integer(sequence.increment)} MINVALUE ${integer(sequence.min)} MAXVALUE ${integer(sequence.max)} CACHE ${integer(sequence.cache)} ${sequence.cycle ? 'CYCLE' : 'NO CYCLE'})`;
      }
      if (column.not_null) definition += ' NOT NULL';
      return definition;
    });
    sql.push(`CREATE TABLE ${qualified(table.schema, table.name)} (\n  ${definitions.join(',\n  ')}\n);`);
  }
  let proofsReplaced = 0;
  const proofFunctions = new Set(['firehouse.execute_server_portal_sql', 'private.portal_server_request']);
  for (const fn of catalog.functions) {
    let definition = fn.definition;
    if (proofFunctions.has(objectKey(fn))) {
      const matches = definition.match(/'[a-f0-9]{64}'/gi) ?? [];
      if (matches.length !== 1 || matches[0] === literal(proofHash)) throw new Error('The target proof must replace exactly one different source proof.');
      definition = definition.replace(/'[a-f0-9]{64}'/i, literal(proofHash));
      proofsReplaced++;
    }
    sql.push(`${definition.trim().replace(/;$/, '')};`);
    sql.push(`REVOKE ALL ON FUNCTION ${qualified(fn.schema, fn.name)}(${fn.arguments}) FROM PUBLIC, anon, authenticated, service_role;`);
  }
  if (proofsReplaced !== 2) throw new Error('Both server proof boundaries must be present.');
  for (const column of catalog.columns) {
    if (column.default && !column.identity) sql.push(`ALTER TABLE ${qualified(column.schema, column.table)} ALTER COLUMN ${identifier(column.name)} SET DEFAULT ${column.default};`);
  }
  for (const constraint of catalog.constraints.filter(value => value.type !== 'f')) {
    sql.push(`ALTER TABLE ${qualified(constraint.schema, constraint.table)} ADD CONSTRAINT ${identifier(constraint.name)} ${constraint.definition};`);
  }
  for (const index of dependencies.indexes) sql.push(`${index.definition};`);
  for (const constraint of catalog.constraints.filter(value => value.type === 'f')) {
    sql.push(`ALTER TABLE ${qualified(constraint.schema, constraint.table)} ADD CONSTRAINT ${identifier(constraint.name)} ${constraint.definition};`);
  }
  for (const view of catalog.relations.filter(relation => relation.kind === 'v')) {
    const options = view.options?.length ? ` WITH (${view.options.join(', ')})` : '';
    sql.push(`CREATE VIEW ${qualified(view.schema, view.name)}${options} AS ${view.view.trim().replace(/;$/, '')};`);
  }
  for (const trigger of catalog.triggers) {
    if (!schemas.has(trigger.schema)) throw new Error('A trigger on a managed schema requires separate review.');
    sql.push(`${trigger.definition};`);
    const enableMode = { O: 'ENABLE', D: 'DISABLE', R: 'ENABLE REPLICA', A: 'ENABLE ALWAYS' }[trigger.enabled];
    if (!enableMode) throw new Error('Unknown trigger state.');
    sql.push(`ALTER TABLE ${qualified(trigger.schema, trigger.table)} ${enableMode} TRIGGER ${identifier(trigger.name)};`);
  }
  for (const table of catalog.relations.filter(relation => relation.kind === 'r')) {
    sql.push(`ALTER TABLE ${qualified(table.schema, table.name)} ${table.rls ? 'ENABLE' : 'DISABLE'} ROW LEVEL SECURITY;`);
    sql.push(`ALTER TABLE ${qualified(table.schema, table.name)} ${table.force_rls ? 'FORCE' : 'NO FORCE'} ROW LEVEL SECURITY;`);
  }
  for (const policy of catalog.policies) {
    if (![...schemas, 'storage'].includes(policy.schemaname)) throw new Error('Unexpected policy schema.');
    if (!policy.roles.every(value => knownRoles.has(value === 'public' ? 'PUBLIC' : value))) throw new Error('Unexpected policy role.');
    let definition = `CREATE POLICY ${identifier(policy.policyname)} ON ${qualified(policy.schemaname, policy.tablename)} AS ${policy.permissive} FOR ${policy.cmd} TO ${policy.roles.map(value => role(value === 'public' ? 'PUBLIC' : value)).join(', ')}`;
    if (policy.qual) definition += ` USING (${policy.qual})`;
    if (policy.with_check) definition += ` WITH CHECK (${policy.with_check})`;
    sql.push(`${definition};`);
  }
  for (const relation of catalog.relations) {
    sql.push(`REVOKE ALL ON ${relation.kind === 'S' ? 'SEQUENCE' : 'TABLE'} ${qualified(relation.schema, relation.name)} FROM PUBLIC, anon, authenticated, service_role;`);
  }
  for (const schema of catalog.schemas) sql.push(`REVOKE ALL ON SCHEMA ${identifier(schema.name)} FROM PUBLIC, anon, authenticated, service_role;`);
  for (const grant of extras.grants) {
    if (!knownRoles.has(grant.role_name) || !privileges.has(grant.privilege_type)) throw new Error('Unrecognized source grant.');
    let target = qualified(grant.schema_name, grant.object_name);
    if (grant.kind === 'SCHEMA') target = identifier(grant.schema_name);
    if (grant.kind === 'FUNCTION') target += `(${grant.arguments})`;
    sql.push(`GRANT ${grant.privilege_type} ON ${grant.kind} ${target} TO ${role(grant.role_name)}${grant.is_grantable ? ' WITH GRANT OPTION' : ''};`);
  }
  // Source default grants are captured for a separate review of future migrations.
  // They are not silently applied across all schemas of a managed Supabase project.
  sql.push('COMMIT;');
  const query = sql.join('\n\n') + '\n';
  return { query, manifest: {
    sourceProject: catalog.source_project, targetProject, capturedAt: catalog.captured_at,
    tables: catalog.relations.filter(relation => relation.kind === 'r').length,
    views: catalog.relations.filter(relation => relation.kind === 'v').length,
    functions: catalog.functions.length, constraints: catalog.constraints.length,
    indexes: dependencies.indexes.length, policies: catalog.policies.length,
    sourceProofsReplaced: proofsReplaced, operationalRecords: 0,
    sha256: createHash('sha256').update(query).digest('hex'),
    pending: ['Review default privileges for future migrations.', 'Provision department configuration and independent identities.', 'Configure private storage buckets without importing file records.'],
  } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [catalogPath, extrasPath, dependenciesPath, targetProject, proofHash, outputPath] = process.argv.slice(2);
  if (!outputPath) throw new Error('Pass catalog, grant/sequence metadata, dependency metadata, target project, proof hash, and output SQL path.');
  const read = path => JSON.parse(readFileSync(path, 'utf8'));
  const plan = buildSchemaPlan(read(catalogPath), read(extrasPath), read(dependenciesPath), targetProject, proofHash);
  writeFileSync(outputPath, plan.query, { mode: 0o600 });
  writeFileSync(`${outputPath}.manifest.json`, JSON.stringify(plan.manifest, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify(plan.manifest));
}
