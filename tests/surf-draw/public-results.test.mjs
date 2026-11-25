import test from 'node:test';
import assert from 'node:assert/strict';
import { keccak256, toUtf8Bytes } from 'ethers';
import { projectSurfPublicResults, readSurfPublicResults } from '../../server/surf-draw/public-results.mjs';
import { SURF_CHAINLINK_REDRAW_ID, SURF_DRAW_PRIZES, decodeSurfSnapshot } from '../../server/surf-draw/model.mjs';
import { surfCampaign } from '../../shared/surf-campaign.js';
import { TICKET_RULE_VERSION } from '../../server/missions/participation-store.mjs';

function fixture() {
  const entries = SURF_DRAW_PRIZES.map((_, slot) => ({ start: slot + 1, end: slot + 1, ticketCount: 1,
    name: `Player ${slot + 1}`, email: `private${slot}@example.com`, userSub: `private-sub-${slot}`,
    walletAddress: '0x' + '1'.repeat(40) }));
  const canonical = { campaignId: surfCampaign.id, ruleVersion: TICKET_RULE_VERSION, drawId: SURF_CHAINLINK_REDRAW_ID,
    rules: { oneWinPerTicket: true, repeatPersonWithDifferentTickets: true, alternatesPerPrize: 0 },
    prizes: SURF_DRAW_PRIZES, entries };
  const canonical_json = JSON.stringify(canonical), ledger_hash = keccak256(toUtf8Bytes(canonical_json));
  const record = { canonical_json, ledger_hash, participant_count: entries.length, ticket_count: entries.length };
  const chain = { state: 4, ledgerMatch: true, drawId: SURF_CHAINLINK_REDRAW_ID, chainId: 56,
    source: '0x' + '2'.repeat(40), block: 123, ledgerHash: ledger_hash, requestId: '456',
    signerAddress: 'private-signer', winners: entries.map((participant, slot) => ({ slot, ticketNumber: slot + 1,
      participant: { ...participant, discordUsername: 'private-discord' } })) };
  return { record, chain };
}

test('public projection exposes only display name, ticket, prize and public proof', () => {
  const { chain } = fixture();
  chain.winners[0].participant.name = 'private@example.com';
  chain.winners[1].participant.name = '0x' + '1'.repeat(40);
  const result = projectSurfPublicResults(chain, '2026-11-20T00:00:00Z');
  assert.equal(result.status, 'complete');
  assert.equal(result.winners.length, 27);
  assert.equal(result.winners.filter(winner => result.prizes[winner.slot].kind === 'mystery-box').length, 7);
  assert.equal(result.winners[0].name, '');
  assert.equal(result.winners[1].name, '');
  for (const winner of result.winners) assert.deepEqual(Object.keys(winner), ['slot', 'ticketNumber', 'name']);
  assert.doesNotMatch(JSON.stringify(result), /private|userSub|walletAddress|email|discordUsername|signerAddress/);
});

test('invalid complete, duplicate, unmapped and mismatched ledger results are rejected', () => {
  for (const mutate of [chain => chain.winners.pop(), chain => { chain.ledgerMatch = false; },
    chain => { chain.winners[1].ticketNumber = chain.winners[0].ticketNumber; },
    chain => { chain.winners[1].slot = chain.winners[0].slot; },
    chain => { chain.winners[0].participant = null; }]) {
    const { chain } = fixture(); mutate(chain);
    assert.throws(() => projectSurfPublicResults(chain, 'now'));
  }
});

test('public read performs SELECT only, validates snapshot and never requests signer or contacts', async () => {
  const { chain, record } = fixture(); let destroyed = 0;
  const queries = [], db = { prepare(sql) { queries.push(sql); assert.match(sql, /^SELECT /);
    return { async get() { return sql.includes('active_round') ? { draw_id: SURF_CHAINLINK_REDRAW_ID } : record; } }; } };
  const result = await readSurfPublicResults({ db, readChain: async (snapshot, options) => {
    assert.equal(snapshot.ledger_hash, record.ledger_hash);
    assert.deepEqual(snapshot.contacts, {});
    assert.deepEqual(options, { drawId: SURF_CHAINLINK_REDRAW_ID, includeSigner: false, includeSubscription: false });
    return { ...chain, provider: { destroy() { destroyed++; } } };
  } });
  assert.equal(result.winners.length, 27); assert.equal(destroyed, 1);
  assert.equal(queries.length, 3); assert.ok(queries.every(query => !query.includes('contact')));
  const tampered = { ...record, canonical_json: record.canonical_json + ' ' };
  assert.throws(() => decodeSurfSnapshot(tampered, SURF_CHAINLINK_REDRAW_ID), /integrity/);
});

test('missing snapshot and an active-round change fail instead of returning empty winners', async () => {
  const { chain, record } = fixture(); let activeReads = 0, destroyed = 0, called = 0;
  const missing = { prepare(sql) { return { async get() { return sql.includes('active_round') ? { draw_id: SURF_CHAINLINK_REDRAW_ID } : null; } }; } };
  await assert.rejects(readSurfPublicResults({ db: missing, readChain: async () => { called++; } }), /locked ledger/);
  assert.equal(called, 0);
  const changing = { prepare(sql) { return { async get() { return sql.includes('active_round') ? { draw_id: ++activeReads === 1 ? SURF_CHAINLINK_REDRAW_ID : 'changed' } : record; } }; } };
  await assert.rejects(readSurfPublicResults({ db: changing, readChain: async () => ({ ...chain, provider: { destroy() { destroyed++; } } }) }), /round changed/);
  assert.equal(destroyed, 1);
});
