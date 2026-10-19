import {mkdir,writeFile,readFile,chmod} from 'node:fs/promises';
import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import {dirname,resolve} from 'node:path';
const platform=process.env.BACKUP_TOOLS_PLATFORM||'linux',arch=platform==='linux'?'amd64':process.arch==='arm64'?'arm64':'amd64';
if(!['linux','darwin'].includes(platform))throw new Error('backup_platform_unsupported');
const target=resolve(process.env.BACKUP_TOOLS_OUTPUT||'server/vendor/backup'),archives=resolve(process.env.BACKUP_TOOLS_ARCHIVES||'/tmp/merch-backup-tool-downloads');
const resticVersion='0.19.1',rcloneVersion='1.74.2';await mkdir(target,{recursive:true});await mkdir(archives,{recursive:true});
const manifest=[];
for(const tool of ['restic','rclone']){
const name=tool==='restic'?`restic_${resticVersion}_${platform}_${arch}.bz2`:`rclone-v${rcloneVersion}-${platform==='darwin'?'osx':platform}-${arch}.zip`;
const base=tool==='restic'?`https://github.com/restic/restic/releases/download/v${resticVersion}/`:`https://downloads.rclone.org/v${rcloneVersion}/`;
const [artifact,sums]=await Promise.all([fetch(base+name),fetch(base+'SHA256SUMS')]);if(!artifact.ok||!sums.ok)throw new Error('backup_tool_download_failed:'+tool);
const body=Buffer.from(await artifact.arrayBuffer()),digest=createHash('sha256').update(body).digest('hex'),line=(await sums.text()).split(/\r?\n/).find(line=>line.trim().endsWith(name));if(!line||line.split(/\s+/)[0]!==digest)throw new Error('backup_tool_checksum_mismatch:'+tool);
const archive=archives+'/'+name;await writeFile(archive,body);
if(tool==='restic')execFileSync('python3',['-c','import bz2,sys;open(sys.argv[2],"wb").write(bz2.decompress(open(sys.argv[1],"rb").read()))',archive,target+'/restic']);
else execFileSync('python3',['-c','import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);n=[n for n in z.namelist() if n.endswith("/rclone")][0];open(sys.argv[2],"wb").write(z.read(n))',archive,target+'/rclone']);
await chmod(target+'/'+tool,0o755);const executable=await readFile(target+'/'+tool);manifest.push({tool,version:tool==='restic'?resticVersion:rcloneVersion,platform,arch,source:base+name,archiveSha256:digest,executableSha256:createHash('sha256').update(executable).digest('hex'),bytes:executable.length});console.log('Verified backup executable',tool,executable.length);
}
await writeFile(target+'/manifest.json',JSON.stringify(manifest,null,2));
