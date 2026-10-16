import { Contract, FetchRequest, JsonRpcProvider, Wallet, keccak256 } from 'ethers';
import { SURF_CHAINLINK_DRAW_ID, SURF_DRAW_ADDRESS, SURF_DRAW_CHAIN_ID, SURF_DRAW_ID, SURF_DRAW_PRIZES, SURF_DRAW_RUNTIME_HASH, findWinner } from './model.mjs';
import { readSurfResults } from './results.mjs';

export const drawAbi = [
  'function state(bytes32) view returns (uint8)',
  'function roundStatus(bytes32) view returns (bool finalized,bool requested,bool fulfilled,uint256 totalTickets,uint256 firstWinningTicket,bytes32 ledgerHash,uint256 prizeSlotCount,uint256 winnerCount)',
  'function requestId(bytes32) view returns (uint256)',
  'function randomWord(bytes32) view returns (uint256)',
  'function winnerTicketsBySlot(bytes32) view returns (uint256[])',
  'function revealedPrizeSlots(bytes32) view returns (uint256[])',
  'function isAdmin(address) view returns (bool)',
  'function vrfCoordinatorAddress() view returns (address)',
  'function vrfConfig() view returns (bytes32 keyHash,uint64 subscriptionId,uint16 requestConfirmations,uint32 callbackGasLimit)',
  'function finalizeLedger(bytes32 drawId,bytes32 ledgerHash,uint256 totalTickets,uint256 prizeSlotCount,string ledgerUri)',
  'function requestDraw(bytes32 drawId) returns (uint256)',
  'function resetDraft(bytes32 drawId)',
];

const coordinatorAbi = [
  'function getSubscription(uint64) view returns (uint96 balance,uint64 reqCount,address owner,address[] consumers)',
  'function pendingRequestExists(uint64) view returns (bool)',
];

export function drawProvider() {
  const url = process.env.SURF_DRAW_RPC_URL?.trim();
  if (!url || !/^https:\/\//.test(url)) throw new Error('SURF_DRAW_RPC_URL is not configured as an HTTPS URL');
  const request = new FetchRequest(url);
  request.timeout = 15_000;
  return new JsonRpcProvider(request, SURF_DRAW_CHAIN_ID, { staticNetwork: true, batchMaxCount: 1 });
}

export function signerFor(provider) {
  const key = process.env.SURF_DRAW_OPERATOR_PRIVATE_KEY?.trim();
  if (!key) return null;
  return new Wallet(key, provider);
}

export async function readSurfChain(snapshot, options = {}) {
  if ((options.drawId || snapshot?.draw_id) === SURF_CHAINLINK_DRAW_ID) {
    const { readChainlinkSurfChain } = await import('./chainlink-chain.mjs');
    return readChainlinkSurfChain(snapshot, options);
  }
  const provider = options.provider || drawProvider();
  try { return await readSurfChainAt(provider, snapshot, options); }
  catch (error) { if (!options.provider) provider.destroy(); throw error; }
}

async function readSurfChainAt(provider, snapshot, { includeSubscription = true, includeSigner = true,
  signer: suppliedSigner, resultsAddress, blockNumber, drawId = snapshot?.draw_id || SURF_DRAW_ID } = {}) {
  const finalized = await provider.getBlock('finalized');
  if (!finalized) throw new Error('Canonical Surf draw finalized block is unavailable');
  if (blockNumber !== undefined && (!Number.isInteger(blockNumber) || blockNumber < 0 || blockNumber > finalized.number)) {
    throw new Error('Canonical Surf draw proof block is not finalized');
  }
  const block = blockNumber ?? finalized.number;
  const chainId = Number(await provider.send('eth_chainId', []));
  if (chainId !== SURF_DRAW_CHAIN_ID) throw new Error(`Wrong chain: ${chainId}`);
  const runtimeHash = keccak256(await provider.getCode(SURF_DRAW_ADDRESS, block));
  if (runtimeHash !== SURF_DRAW_RUNTIME_HASH) throw new Error('Canonical Surf draw source runtime does not match');
  const contract = new Contract(SURF_DRAW_ADDRESS, drawAbi, provider);
  const signer = includeSigner ? suppliedSigner || signerFor(provider) : null;
  const [stateRaw, status, requestId, originalSlots, randomWord, config, coordinatorAddress, signerAdmin] = await Promise.all([
    contract.state(drawId, { blockTag: block }), contract.roundStatus(drawId, { blockTag: block }),
    contract.requestId(drawId, { blockTag: block }), contract.revealedPrizeSlots(drawId, { blockTag: block }),
    contract.randomWord(drawId, { blockTag: block }), contract.vrfConfig({ blockTag: block }),
    contract.vrfCoordinatorAddress({ blockTag: block }), signer ? contract.isAdmin(signer.address, { blockTag: block }) : null,
  ]);
  const sourceState = Number(stateRaw);
  if (originalSlots.length || Number(status.winnerCount)) throw new Error('Canonical Surf draw has results from a different selector; reset or reconcile first');
  const results = await readSurfResults(provider, { drawId, state: sourceState, ledgerHash: status.ledgerHash, requestId,
    randomWord, totalTickets: status.totalTickets, prizeSlotCount: status.prizeSlotCount }, block, resultsAddress);
  const { tickets, slots } = results;
  const state = results.status.complete ? 4 : sourceState;
  const ledgerMatch = Boolean(snapshot && status.ledgerHash.toLowerCase() === snapshot.ledger_hash.toLowerCase() &&
    Number(status.totalTickets) === snapshot.ticket_count && Number(status.prizeSlotCount) === SURF_DRAW_PRIZES.length);
  // Keep the contract's publication order. Slot number is the prize identity,
  // not the number of results already published.
  const winners = slots.map(rawSlot => {
    const slot = Number(rawSlot);
    const ticket = tickets[slot];
    if (!Number.isInteger(slot) || slot < 0 || slot >= SURF_DRAW_PRIZES.length || !ticket) {
      throw new Error('On-chain winners contain an invalid prize slot');
    }
    const entry = ledgerMatch ? findWinner(snapshot, ticket) : null;
    return { slot, ticketNumber: Number(ticket), participant: entry ? {
      name: entry.name, walletAddress: entry.walletAddress, email: entry.email,
      ...snapshot.contacts[entry.userSub],
      ticketRange: [entry.start, entry.end],
    } : null };
  });
  if (new Set(winners.map(winner => winner.slot)).size !== winners.length ||
      winners.some((winner) => !winner.participant) || new Set(winners.map((winner) => winner.ticketNumber)).size !== winners.length) {
    throw new Error('On-chain winners cannot be uniquely mapped to the locked Surf ledger');
  }
  let subscription = null;
  if (includeSubscription) {
    const coordinator = new Contract(coordinatorAddress, coordinatorAbi, provider);
    const [record, pending] = await Promise.all([
      coordinator.getSubscription(config.subscriptionId, { blockTag: block }),
      coordinator.pendingRequestExists(config.subscriptionId, { blockTag: block }),
    ]);
    subscription = { id: config.subscriptionId.toString(), balanceWei: record.balance.toString(),
      requestCount: record.reqCount.toString(), consumerRegistered: record.consumers.some((address) => address.toLowerCase() === SURF_DRAW_ADDRESS.toLowerCase()),
      pendingRequest: pending };
  }
  return { provider, contract, resultsContract: results.contract, signer, block, chainId, drawId, state, sourceState,
    results: results.status, ledgerMatch, requestId: requestId.toString(),
    source: SURF_DRAW_ADDRESS, runtimeHash, signerAddress: signer?.address || null, signerAdmin,
    totalTickets: Number(status.totalTickets), prizeSlotCount: Number(status.prizeSlotCount),
    ledgerHash: status.ledgerHash, winnerCount: winners.length, winners,
    vrf: { coordinatorAddress, subscription, keyHash: config.keyHash, confirmations: Number(config.requestConfirmations), callbackGasLimit: Number(config.callbackGasLimit) } };
}

export function publicChainState(chain) {
  const { provider: _provider, contract: _contract, resultsContract: _resultsContract, signer: _signer, ...state } = chain;
  return state;
}
