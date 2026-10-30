import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { registryRoundId } from '../../shared/public-proof/worlds/round-identity.mjs';
import { RUNTIME_HASH, REGISTRY_RUNTIME_HASH, supportedRuntime, collectChainFacts } from '../../shared/public-proof/worlds/chain.mjs';
import { canonical, digest, validateManifest, verifyBundle } from '../../shared/public-proof/worlds/protocol.mjs';
import { worldsProofConfig } from '../../server/public-proof/config.mjs';
import { createPublicProofRoutes } from '../../server/public-proof/routes.mjs';
import { fixture, testBundle } from './fixtures.mjs';

const h = n => '0x' + String(n).repeat(64);
const oldContract = '0x1111111111111111111111111111111111111111';
const contract = '0x2222222222222222222222222222222222222222';
const chain = { chainId: 56, contract, runtimeHash: REGISTRY_RUNTIME_HASH, commitmentTx: h(1), requestTx: h(2),
  commitmentBlockNumber: 3, commitmentBlockHash: h(3), requestBlockNumber: 4, requestBlockHash: h(4) };
const authority = { configured: true, ...chain, publicRpc: 'https://bsc-dataseed.bnbchain.org' };
const versioned = (sequence, count = 7) => {
  const manifest = fixture('final', [count]);
  manifest.roundIdentity = { version: 2, eventId: 'worlds-2026', stage: 'final', sequence };
  manifest.roundId = registryRoundId(manifest.roundIdentity);
  return manifest;
};
function capture() {
  return { headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    writeHead(status, headers = {}) { this.status = status; for (const [k, v] of Object.entries(headers)) this.setHeader(k, v); },
    end(body) { this.body = body; } };
}

test('registry rounds preserve legacy verification and use event/stage/sequence identities', () => {
  const legacy = testBundle(fixture(), { ...chain, contract: oldContract, runtimeHash: RUNTIME_HASH });
  assert.equal(verifyBundle(legacy).bundleHash, digest(legacy));
  const first = testBundle(versioned(1, 7), chain), second = testBundle(versioned(2, 35), { ...chain, requestTx: h(5) });
  assert.notEqual(first.commitment.roundId, second.commitment.roundId);
  assert.equal(verifyBundle(first).picks.length, 3);
  assert.equal(verifyBundle(second).picks.length, 3);
  const tampered = structuredClone(first.manifest); tampered.roundIdentity.sequence = 2;
  assert.throws(() => validateManifest(tampered), /round/);
  assert.throws(() => registryRoundId({ version: 2, eventId: 'worlds-2026', stage: 'final', sequence: 0 }));
});

test('authority configuration accepts only reviewed builds and independently approved historical addresses', async () => {
  assert.ok(supportedRuntime(RUNTIME_HASH)); assert.ok(supportedRuntime(REGISTRY_RUNTIME_HASH));
  const environment = { MERCH_WORLDS_PROOF_CHAIN_ID: '56', MERCH_WORLDS_PROOF_CONTRACT: contract,
    MERCH_WORLDS_PROOF_RUNTIME_HASH: REGISTRY_RUNTIME_HASH, MERCH_WORLDS_PROOF_PUBLIC_RPC: authority.publicRpc,
    MERCH_WORLDS_PROOF_HISTORICAL_AUTHORITIES: JSON.stringify([{ chainId: 56, contract: oldContract,
      runtimeHash: RUNTIME_HASH, publicRpc: authority.publicRpc, context: 'rehearsal' }]) };
  const configured = worldsProofConfig(environment);
  assert.equal(configured.authorities.length, 2);
  assert.equal(configured.authority.runtimeHash, REGISTRY_RUNTIME_HASH);
  assert.equal(configured.authorities[1].context, 'rehearsal');
  assert.throws(() => worldsProofConfig({ ...environment, MERCH_WORLDS_PROOF_RUNTIME_HASH: h(9) }), /Unreviewed/);
  await assert.rejects(collectChainFacts({}, { ...authority, runtimeHash: h(9) }, {}, {}), /unreviewed/);
});

test('relay forwards every exact history selector, preserves bytes and rejects a latest-record substitution', async () => {
  const old = testBundle(versioned(1), chain), hash = digest(old);
  const selectors = new URLSearchParams({ download: '1', bundleHash: hash, tx: chain.requestTx, roundId: old.commitment.roundId });
  let called;
  const relay = createPublicProofRoutes({ environment: { MERCH_WORLDS_PROOF_ORIGIN: 'https://event.test' },
    fetchPublic: async url => { called = new URL(url); return new Response(canonical(old), { headers: { 'content-type': 'application/json', 'x-proof-sha256': hash } }); } });
  const res = capture(); await relay({ method: 'GET' }, res, new URL(`https://merch.test/api/public-proofs/worlds-2026/final/bundle?${selectors}`));
  assert.equal(called.origin, 'https://event.test');
  for (const [key, value] of selectors) assert.equal(called.searchParams.get(key), value);
  assert.equal(res.body.toString(), canonical(old));
  await assert.rejects(relay({ method: 'GET' }, capture(), new URL(`https://merch.test/api/public-proofs/worlds-2026/final/bundle?tx=${h(9)}`)), e => e.code === 'proof_record_changed');
  await assert.rejects(relay({ method: 'GET' }, capture(), new URL(`https://merch.test/api/public-proofs/worlds-2026/final/bundle?tx=${h(2)}&tx=${h(2)}`)), e => e.status === 400);
});

test('public history cannot replace approved authority or inject a remote proof URL', async () => {
  const record = testBundle(versioned(1), chain), hash = digest(record);
  const relay = createPublicProofRoutes({ environment: { MERCH_WORLDS_PROOF_ORIGIN: 'https://event.test' }, fetchPublic: async () => Response.json({
    stage: 'final', registry: { ...authority }, rounds: [{ stage: 'final', roundId: record.commitment.roundId,
      status: 'published', bundleHash: hash, requestTx: chain.requestTx, proofUrl: 'https://unapproved.test' }] }) });
  const res = capture(); await relay({ method: 'GET' }, res, new URL('https://merch.test/api/public-proofs/worlds-2026/final/history'));
  const history = JSON.parse(res.body);
  assert.equal(history.registry, undefined);
  assert.match(history.rounds[0].proofUrl, /^\/api\/public-proofs\//);
  assert.ok(!res.body.includes('unapproved.test'));
});

test('hash lookup finds old records across stages even when the latest round changed, without trusting bundle authority', async () => {
  const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', optimizeDeps: { noDiscovery: true } });
  const saved = globalThis.fetch;
  try {
    const client = await vite.ssrLoadModule('/src/components/PublicVerification/proofClient.ts');
    const old = testBundle(versioned(1), chain), hash = digest(old);
    const overview = { event: 'worlds-2026', authority, authorities: [authority],
      rounds: ['quarter', 'semi', 'final'].map(stage => ({ stage, status: 'published', roundId: h(9), bundleHash: h(9) })) };
    globalThis.fetch = async url => {
      const parsed = new URL(url, 'https://merch.test');
      assert.equal(parsed.searchParams.get('tx'), chain.requestTx);
      if (!parsed.pathname.endsWith('/final/bundle')) return Response.json({ code: 'proof_not_published' }, { status: 409 });
      return new Response(canonical(old), { headers: { 'x-proof-sha256': hash } });
    };
    const proof = await client.readProofByIdentity(overview, '', chain.requestTx, new AbortController().signal);
    assert.equal(proof.bundleHash, hash); assert.equal(proof.bundle.commitment.roundId, old.commitment.roundId);
    await assert.rejects(client.readProofByIdentity(overview, hash, chain.requestTx, new AbortController().signal, 'quarter'), /找不到/);
    await assert.rejects(client.readProofByIdentity({ ...overview, authorities: [{ ...authority, contract: oldContract }] }, '', chain.requestTx, new AbortController().signal), /獨立核准/);
    globalThis.fetch = async () => Response.json({ code: 'proof_not_published' }, { status: 409 });
    await assert.rejects(client.readProofByIdentity(overview, '', chain.requestTx, new AbortController().signal), /找不到/);
  } finally { globalThis.fetch = saved; await vite.close(); }
});
