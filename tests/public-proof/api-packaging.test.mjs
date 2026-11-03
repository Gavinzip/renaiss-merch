import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

test('public API metadata and relay initialize without loading browser cryptography', async () => {
  const source = fileURLToPath(new URL('../../', import.meta.url));
  const isolated = await mkdtemp(path.join(tmpdir(), 'merch-proof-package-'));
  try {
    // The deployment's control-plane files; no protocol, chain or vendor TS.
    for (const name of ['server/http.mjs', 'server/public-proof/config.mjs', 'server/public-proof/routes.mjs',
      'shared/public-proof/worlds/runtime-catalog.mjs', 'shared/public-proof/worlds/contract-build.json',
      'shared/public-proof/worlds/registry-build.json','shared/public-proof/worlds/registry-v3-build.json', 'package.json']) {
      const target = path.join(isolated, name);
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(path.join(source, name), target);
    }
    await symlink(path.join(source, 'node_modules'), path.join(isolated, 'node_modules'), 'dir');
    const { worldsProofConfig } = await import(pathToFileURL(path.join(isolated, 'server/public-proof/config.mjs')));
    const { createPublicProofRoutes } = await import(pathToFileURL(path.join(isolated, 'server/public-proof/routes.mjs')));
    assert.equal(worldsProofConfig({}).authorities.length, 0);
    const route = createPublicProofRoutes({ environment: { MERCH_WORLDS_PROOF_ORIGIN: 'https://event.test' },
      fetchPublic: async () => Response.json({ rounds: ['quarter', 'semi', 'final'].map(stage => ({ stage, status: 'awaiting_results' })) }) });
    const response = { writeHead(status) { this.status = status; }, end(body) { this.body = JSON.parse(body); } };
    assert.equal(await route({ method: 'GET' }, response, new URL('https://merch.test/api/public-proofs/worlds-2026/rounds')), true);
    assert.equal(response.status, 200);
    assert.equal(response.body.rounds.length, 3);
  } finally {
    await rm(isolated, { recursive: true, force: true });
  }
});

test('every known match snapshot has a literal platform route before the generic API capture',async()=>{
  const {readFile}=await import('node:fs/promises');
  const config=JSON.parse(await readFile(new URL('../../vercel.json',import.meta.url),'utf8'));
  const generic=config.rewrites.findIndex(r=>r.source==='/api/:path*');
  for(const id of ['qf-01','qf-02','qf-03','qf-04','sf-01','sf-02','gf-01']){
    const index=config.rewrites.findIndex(r=>r.source===`/api/public-proofs/worlds-2026/matches/${id}/snapshot`&&r.destination==='/api/index');
    assert.ok(index>=0&&index<generic,'Strict proof queries must not receive the generic rewrite path capture: '+id);
  }
});
