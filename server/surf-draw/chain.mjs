import { Contract, FetchRequest, JsonRpcProvider, Wallet, keccak256 } from 'ethers';
import { SURF_DRAW_ADDRESS, SURF_DRAW_CHAIN_ID, SURF_DRAW_ID, SURF_DRAW_PRIZES, SURF_DRAW_RUNTIME_HASH, findWinner } from './model.mjs';

export const drawAbi = [
  'function state(bytes32) view returns (uint8)',
  'function roundStatus(bytes32) view returns (bool finalized,bool requested,bool fulfilled,uint256 totalTickets,uint256 firstWinningTicket,bytes32 ledgerHash,uint256 prizeSlotCount,uint256 winnerCount)',
  'function requestId(bytes32) view returns (uint256)',
  'function winnerTicketsBySlot(bytes32) view returns (uint256[])',
  'function revealedPrizeSlots(bytes32) view returns (uint256[])',
  'function isAdmin(address) view returns (bool)',
  'function vrfCoordinatorAddress() view returns (address)',
  'function vrfConfig() view returns (bytes32 keyHash,uint64 subscriptionId,uint16 requestConfirmations,uint32 callbackGasLimit)',
  'function finalizeLedger(bytes32 drawId,bytes32 ledgerHash,uint256 totalTickets,uint256 prizeSlotCount,string ledgerUri)',
  'function requestDraw(bytes32 drawId) returns (uint256)',
  'function drawPrizeSlots(bytes32 drawId,uint256[] prizeSlotIndexes) returns (uint256[])',
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

export async function readSurfChain(snapshot, { includeSubscription = true, includeSigner = true } = {}) {
  const provider = drawProvider();
  const block = await provider.getBlockNumber();
  const chainId = Number(await provider.send('eth_chainId', []));
  if (chainId !== SURF_DRAW_CHAIN_ID) throw new Error(`Wrong chain: ${chainId}`);
  const runtimeHash = keccak256(await provider.getCode(SURF_DRAW_ADDRESS, block));
  if (runtimeHash !== SURF_DRAW_RUNTIME_HASH) throw new Error('Canonical Surf draw source runtime does not match');
  const contract = new Contract(SURF_DRAW_ADDRESS, drawAbi, provider);
  const signer = includeSigner ? signerFor(provider) : null;
  const [stateRaw, status, requestId, tickets, slots, config, coordinatorAddress, signerAdmin] = await Promise.all([
    contract.state(SURF_DRAW_ID, { blockTag: block }), contract.roundStatus(SURF_DRAW_ID, { blockTag: block }),
    contract.requestId(SURF_DRAW_ID, { blockTag: block }), contract.winnerTicketsBySlot(SURF_DRAW_ID, { blockTag: block }),
    contract.revealedPrizeSlots(SURF_DRAW_ID, { blockTag: block }), contract.vrfConfig({ blockTag: block }),
    contract.vrfCoordinatorAddress({ blockTag: block }), signer ? contract.isAdmin(signer.address, { blockTag: block }) : null,
  ]);
  const state = Number(stateRaw);
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
      ticketRange: [entry.start, entry.end],
    } : null };
  });
  if (winners.length !== Number(status.winnerCount) || new Set(winners.map(winner => winner.slot)).size !== winners.length ||
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
  return { provider, contract, signer, block, chainId, state, ledgerMatch, requestId: requestId.toString(),
    source: SURF_DRAW_ADDRESS, runtimeHash, signerAddress: signer?.address || null, signerAdmin,
    totalTickets: Number(status.totalTickets), prizeSlotCount: Number(status.prizeSlotCount),
    ledgerHash: status.ledgerHash, winnerCount: Number(status.winnerCount), winners,
    vrf: { coordinatorAddress, subscription, keyHash: config.keyHash, confirmations: Number(config.requestConfirmations), callbackGasLimit: Number(config.callbackGasLimit) } };
}

export function publicChainState(chain) {
  const { provider: _provider, contract: _contract, signer: _signer, ...state } = chain;
  return state;
}
