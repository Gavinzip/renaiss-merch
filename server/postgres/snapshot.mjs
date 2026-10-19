import {readFile} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {getPool} from './database.mjs';
const digest=value=>createHash('sha256').update(value).digest('hex');
export const hashRows=rows=>digest(JSON.stringify(rows.map(row=>JSON.stringify(Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b))))).sort()));
const schemaSource=()=>readFile(new URL('./schema.sql',import.meta.url),'utf8');
export async function exportPostgresSnapshot(client) {
  const ddl=await schemaSource(),names=[...ddl.matchAll(/CREATE TABLE ([a-z_]+)/g)].map(m=>m[1]),tables=[];
  for(const name of names){const rows=(await client.query(`SELECT * FROM public.${name}`)).rows;
    tables.push({name,rows,sha256:hashRows(rows)});}
  const snapshot={format:'renaiss-merch-postgres-v1',createdAt:new Date().toISOString(),schemaSha256:digest(ddl),tables};
  const bytes=gzipSync(JSON.stringify(snapshot));
  return {bytes,sha256:digest(bytes),tables:tables.map(t=>({name:t.name,rows:t.rows.length,sha256:t.sha256}))};
}
export function inspectPostgresSnapshot(bytes) {
  const snapshot=JSON.parse(gunzipSync(bytes));
  if(snapshot.format!=='renaiss-merch-postgres-v1'||!Array.isArray(snapshot.tables))throw new Error('backup_format_invalid');
  for(const table of snapshot.tables)if(!/^[a-z_]+$/.test(table.name)||hashRows(table.rows)!==table.sha256)throw new Error('backup_integrity_failed');
  return snapshot;
}
// Restore is an explicit operator operation, never an HTTP route. Rehearsals
// must use an empty, dedicated schema so active application data is untouched.
export async function restorePostgresSnapshot(bytes, schema, pool=getPool()) {
  if(!/^merch_restore_[a-z0-9_]+$/.test(schema))throw new Error('isolated_restore_schema_required');
  const snapshot=inspectPostgresSnapshot(bytes),ddl=await schemaSource();
  if(digest(ddl)!==snapshot.schemaSha256)throw new Error('backup_schema_version_mismatch');
  const client=await pool.connect(),report=[];
  try{await client.query('BEGIN');await client.query(`CREATE SCHEMA ${schema}`);await client.query(`SET LOCAL search_path=${schema}`);await client.query(ddl);
    for(const table of snapshot.tables){
      const columns=table.rows.length?Object.keys(table.rows[0]):[];
      if(columns.some(c=>!/^[a-z0-9_]+$/.test(c)))throw new Error('backup_column_invalid');
      for(let offset=0;offset<table.rows.length;offset+=200){const rows=table.rows.slice(offset,offset+200);await client.query(`INSERT INTO ${schema}.${table.name} (${columns.join(',')}) VALUES ${rows.map((_,i)=>'('+columns.map((_,j)=>'$'+(i*columns.length+j+1)).join(',')+')').join(',')}`,rows.flatMap(row=>columns.map(c=>row[c])));}
      const target=(await client.query(`SELECT * FROM ${schema}.${table.name}`)).rows;
      if(hashRows(target)!==table.sha256)throw new Error('backup_restore_hash_mismatch');
      report.push({name:table.name,rows:target.length,sha256:table.sha256});
    }
    const identities=(await client.query(`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=$1 AND is_identity='YES'`,[schema])).rows;
    for(const {table_name:table,column_name:column} of identities)await client.query(`SELECT setval(pg_get_serial_sequence($1,$2),GREATEST(COALESCE((SELECT MAX(${column}) FROM ${schema}.${table}),0),1),EXISTS(SELECT 1 FROM ${schema}.${table}))`,[schema+'.'+table,column]);
    await client.query('COMMIT');return {schema,tables:report};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
