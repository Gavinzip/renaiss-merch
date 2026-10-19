import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash,timingSafeEqual} from 'node:crypto';
import {getPool} from './database.mjs';
import {exportPostgresSnapshot,inspectPostgresSnapshot} from './snapshot.mjs';
import {HttpError,sendJson} from '../http.mjs';
const execute=promisify(execFile);
export async function runPostgresBackup(operation,{binaryDir=resolve('server/vendor/backup'),retainStaging=false}={}) {
  const repository=process.env.BACKUP_REPOSITORY,password=process.env.RESTIC_PASSWORD;
  if(!repository?.startsWith('rclone:gdrive:')||!password)throw new HttpError(503,'backup_not_configured');
  const client=await getPool().connect(),staging=await mkdtemp(join(tmpdir(),'merch-postgres-backup-'));
  const env={...process.env,RESTIC_REPOSITORY:repository,RESTIC_PASSWORD:password,RESTIC_CACHE_DIR:staging+'/cache',
    RCLONE_CONFIG:staging+'/rclone.conf',PATH:binaryDir+':'+process.env.PATH};
  const restic=async args=>execute(join(binaryDir,'restic'),['--no-cache','-o','rclone.program='+join(binaryDir,'rclone'),...args],{env,timeout:660000,maxBuffer:64*1024*1024});
  try{
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const {rows:[lock]}=await client.query('SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired',['merch-postgres-offsite-backup']);
    if(!lock.acquired)throw new HttpError(409,'backup_in_progress');
    if(operation==='check'){
      await restic(['check','--read-data-subset=5%']);await client.query('COMMIT');
      return {checkedAt:new Date().toISOString(),backend:'restic-rclone-gdrive'};
    }
    const snapshot=await exportPostgresSnapshot(client),file=staging+'/merch-postgres.json.gz';
    await writeFile(file,snapshot.bytes,{mode:0o600});
    let initialized=false;
    try{await restic(['cat','config']);}catch(error){if(!/unable to open config file|Is there a repository at the following location/.test(error.stderr||''))throw error;await restic(['init']);initialized=true;}
    const response=await restic(['backup','--json','--tag','renaiss-merch','--tag','postgres','--host','renaiss-merch',file]);
    const summary=response.stdout.trim().split('\n').map(line=>JSON.parse(line)).find(row=>row.message_type==='summary');
    if(!summary?.snapshot_id)throw new Error('backup_snapshot_id_missing');
    // execFile defaults to UTF-8; dump is binary and must be requested separately.
    const dumped=await execute(join(binaryDir,'restic'),['--no-cache','-o','rclone.program='+join(binaryDir,'rclone'),'dump',summary.snapshot_id,file],{env,timeout:660000,maxBuffer:64*1024*1024,encoding:'buffer'});
    if(createHash('sha256').update(dumped.stdout).digest('hex')!==snapshot.sha256)throw new Error('offsite_backup_readback_failed');
    inspectPostgresSnapshot(dumped.stdout);
    await restic(['forget','--prune','--tag','renaiss-merch','--group-by','host,tags',...['hourly','daily','weekly','monthly'].flatMap(unit=>['--keep-'+unit,process.env['BACKUP_KEEP_'+unit.toUpperCase()]||({hourly:48,daily:14,weekly:8,monthly:12})[unit].toString()])]);
    await client.query('COMMIT');
    return {bytes:snapshot.bytes.length,completedAt:new Date().toISOString(),repositoryInitialized:initialized,snapshotId:summary.snapshot_id,sha256:snapshot.sha256,readBackVerified:true,tables:snapshot.tables,backend:'restic-rclone-gdrive',staging};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();if(!retainStaging)await rm(staging,{recursive:true,force:true});}
}
export async function handleBackupRoute(req,res,url){
  if(!['/api/internal/backup','/api/internal/backup/check','/api/internal/backup/cron','/api/internal/backup/check/cron'].includes(url.pathname))return false;
  const cron=url.pathname.endsWith('/cron');
  if(req.method!==(cron?'GET':'POST'))throw new HttpError(405,'method_not_allowed');
  const expected=(cron?process.env.CRON_SECRET:process.env.BACKUP_TRIGGER_SECRET)||'',supplied=String(req.headers.authorization||'').replace(/^Bearer /,'');
  const hash=v=>createHash('sha256').update(v).digest();
  if(expected.length<48||!timingSafeEqual(hash(expected),hash(supplied)))throw new HttpError(401,'backup_unauthorized');
  const result=await runPostgresBackup(url.pathname.includes('/check')?'check':'backup');
  const {staging,tables,...metadata}=result;
  sendJson(res,200,metadata);return true;
}
