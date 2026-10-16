import { AbiCoder, Contract, getAddress, keccak256 } from 'ethers';
import build from '../../shared/draw-results-contract.json' with { type: 'json' };
import { SURF_DRAW_ADDRESS, SURF_DRAW_CHAIN_ID, SURF_DRAW_ID, SURF_DRAW_RUNTIME_HASH } from './model.mjs';

export const resultsAbi = build.abi;
export const resultsRuntimeHash = build.runtimeHash;
export function surfResultId(ledgerHash, requestId, drawId = SURF_DRAW_ID) {
  return keccak256(AbiCoder.defaultAbiCoder().encode(
    ['uint256', 'address', 'bytes32', 'bytes32', 'bytes32', 'uint256'],
    [SURF_DRAW_CHAIN_ID, SURF_DRAW_ADDRESS, SURF_DRAW_RUNTIME_HASH, drawId, ledgerHash, requestId],
  ));
}

// Absence is a visible, non-operational configuration state. It never invokes
// the old selector, another deployment, or off-chain picks.
export async function readSurfResults(provider, source, block, configuredAddress = process.env.SURF_DRAW_RESULTS_ADDRESS?.trim()) {
  const drawId = source.drawId || SURF_DRAW_ID;
  if (!configuredAddress) {
    if (source.state !== 0) throw new Error('Surf draw results contract is not configured');
    return { contract: null, tickets: [], slots: [],
      status: { ready: false, address: null, runtimeHash: resultsRuntimeHash, resultId: null, bound: false, complete: false } };
  }
  let address;
  try { address = getAddress(configuredAddress); } catch { throw new Error('Surf draw results address is invalid'); }
  if (keccak256(await provider.getCode(address, block)) !== resultsRuntimeHash) throw new Error('Surf draw results runtime does not match');
  const contract = new Contract(address, resultsAbi, provider);
  const [chainId, canonical, canonicalHash] = await Promise.all([
    contract.CHAIN_ID({ blockTag: block }), contract.SOURCE({ blockTag: block }), contract.SOURCE_CODE_HASH({ blockTag: block }),
  ]);
  if (Number(chainId) !== SURF_DRAW_CHAIN_ID || canonical !== SURF_DRAW_ADDRESS || canonicalHash !== SURF_DRAW_RUNTIME_HASH) {
    throw new Error('Surf draw results source binding does not match');
  }
  const base = { ready: true, address, runtimeHash: resultsRuntimeHash, resultId: null, bound: false, complete: false };
  if (source.requestId === 0n) return { contract, tickets: [], slots: [], status: base };
  const resultId = surfResultId(source.ledgerHash, source.requestId, drawId);
  const [record, tickets, slots] = await Promise.all([
    contract.resultStatus(resultId, { blockTag: block }), contract.winnerTicketsBySlot(resultId, { blockTag: block }),
    contract.revealedPrizeSlots(resultId, { blockTag: block }),
  ]);
  if (!record.bound) {
    if (slots.length || tickets.length) throw new Error('Surf draw results contain unbound selections');
    return { contract, tickets, slots, status: { ...base, resultId } };
  }
  if (source.state !== 3 || record.drawId !== drawId || record.ledgerHash !== source.ledgerHash ||
      record.requestId !== source.requestId || record.randomWord !== source.randomWord ||
      record.totalTickets !== source.totalTickets || record.prizeSlotCount !== source.prizeSlotCount ||
      record.revealedCount !== BigInt(slots.length) || tickets.length !== Number(record.prizeSlotCount)) {
    throw new Error('Surf draw results no longer match the canonical VRF and ledger');
  }
  return { contract, tickets, slots, status: { ...base, resultId, bound: true,
    snapshotBlock: Number(record.snapshotBlock), complete: slots.length === Number(record.prizeSlotCount) } };
}
