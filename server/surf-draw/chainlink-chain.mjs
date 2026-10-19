import { AbiCoder, Contract, getAddress, keccak256 } from 'ethers';
import build from '../../shared/chainlink-surf-contract.json' with { type: 'json' };
import reusableBuild from '../../shared/chainlink-surf-reusable-contract.json' with { type: 'json' };
import { drawProvider, signerFor } from './chain.mjs';
import { findWinner, SURF_CHAINLINK_DRAW_ID, SURF_CHAINLINK_REDRAW_ID, SURF_DRAW_CHAIN_ID, SURF_DRAW_PRIZES } from './model.mjs';
const WRAPPER = '0x471506e6ADED0b9811D05B8cAc8Db25eE839Ac94';
const COORDINATOR = '0xd691f04bc0C9a24Edb78af9E005Cf85768F694C9';
const wrapperAbi = ['function estimateRequestPriceNative(uint32,uint32,uint256) view returns(uint256)', 'function s_disabled() view returns(bool)'];
export async function chainlinkRequestTransaction(chain, gasPrice) {
  const wrapper = new Contract(WRAPPER, wrapperAbi, chain.provider);
  if (await wrapper.s_disabled()) throw new Error('Chainlink VRF direct funding is disabled');
  const quote = await wrapper.estimateRequestPriceNative(200_000, 1, gasPrice);
  if (quote <= 0n || quote > 2_000_000_000_000_000n) throw new Error('Chainlink VRF price exceeds the request budget');
  return chain.contract.requestDraw.populateTransaction(chain.drawId, {
    value: quote
  });
}
export async function readChainlinkSurfChain(snapshot, options = {}) {
  const provider = options.provider || drawProvider();
  try {
    return await readAt(provider, snapshot, options);
  } catch (error) {
    if (!options.provider) provider.destroy();
    throw error;
  }
}
async function readAt(provider, snapshot, {
  includeSigner = true,
  signer: suppliedSigner,
  blockNumber,
  drawId = snapshot?.draw_id || SURF_CHAINLINK_DRAW_ID
} = {}) {
  if (drawId !== SURF_CHAINLINK_DRAW_ID && drawId !== SURF_CHAINLINK_REDRAW_ID) throw new Error('Wrong Chainlink Surf draw ID');
  const finalized = await provider.getBlock('finalized');
  if (!finalized || blockNumber !== undefined && (blockNumber < 0 || blockNumber > finalized.number)) throw new Error('Canonical Surf draw finalized block is unavailable');
  const block = blockNumber ?? finalized.number;
  const chainId = Number(await provider.send('eth_chainId', []));
  if (chainId !== SURF_DRAW_CHAIN_ID) throw new Error(`Wrong chain: ${chainId}`);
  const reusable = drawId === SURF_CHAINLINK_REDRAW_ID;
  const configuredAddress = (reusable ? process.env.SURF_CHAINLINK_REDRAW_SOURCE_ADDRESS : process.env.SURF_CHAINLINK_SOURCE_ADDRESS)?.trim();
  const expectedHash = (reusable ? process.env.SURF_CHAINLINK_REDRAW_RUNTIME_HASH : process.env.SURF_CHAINLINK_RUNTIME_HASH)?.trim();
  if (!configuredAddress || !expectedHash) throw new Error('Chainlink Surf contract is not configured');
  const source = getAddress(configuredAddress);
  if (!/^0x[a-fA-F0-9]{64}$/.test(expectedHash)) throw new Error('Chainlink Surf runtime hash is invalid');
  const runtimeHash = keccak256(await provider.getCode(source, block));
  if (runtimeHash.toLowerCase() !== expectedHash.toLowerCase()) throw new Error('Chainlink Surf runtime does not match');
  const contract = new Contract(source, reusable ? reusableBuild.abi : build.abi, provider);
  const signer = includeSigner ? suppliedSigner || signerFor(provider) : null;
  const [configuredId, configuredChain, configuredWrapper, owner, stageRaw, status, requestId, randomWord, slots, tickets, signerAdmin] = await Promise.all([contract.DRAW_ID({
    blockTag: block
  }), contract.CHAIN_ID({
    blockTag: block
  }), contract.WRAPPER({
    blockTag: block
  }), contract.owner({
    blockTag: block
  }), await contract.state(drawId, {
    blockTag: block
  }), contract.roundStatus(drawId, {
    blockTag: block
  }), contract.requestId(drawId, {
    blockTag: block
  }), contract.randomWord(drawId, {
    blockTag: block
  }), contract.revealedPrizeSlots(drawId, {
    blockTag: block
  }), contract.winnerTicketsBySlot(drawId, {
    blockTag: block
  }), signer ? contract.isAdmin(signer.address, {
    blockTag: block
  }) : null]);
  if (configuredId !== drawId || Number(configuredChain) !== chainId || configuredWrapper.toLowerCase() !== WRAPPER.toLowerCase() || owner.toLowerCase() !== (signer?.address || owner).toLowerCase()) throw new Error('Chainlink Surf source binding does not match');
  const sourceState = Number(stageRaw);
  const state = sourceState;
  const ledgerMatch = Boolean(snapshot && status.ledgerHash_.toLowerCase() === snapshot.ledger_hash.toLowerCase() && Number(status.totalTickets_) === snapshot.ticket_count && Number(status.prizeSlotCount_) === SURF_DRAW_PRIZES.length);
  if (slots.length && !ledgerMatch) throw new Error('Chainlink Surf ledger commitment does not match the locked snapshot');
  if (slots.length !== Number(status.winnerCount) || sourceState < 3 && slots.length) throw new Error('Chainlink Surf results state is inconsistent');
  const winners = slots.map(rawSlot => {
    const slot = Number(rawSlot);
    const ticket = Number(tickets[slot]);
    if (!Number.isInteger(slot) || slot < 0 || slot >= SURF_DRAW_PRIZES.length || !Number.isInteger(ticket) || ticket < 1) throw new Error('Chainlink Surf result slot is invalid');
    const entry = ledgerMatch ? findWinner(snapshot, ticket) : null;
    return {
      slot,
      ticketNumber: ticket,
      participant: entry ? {
        name: entry.name,
        walletAddress: entry.walletAddress,
        email: entry.email,
        ...snapshot.contacts[entry.userSub],
        ticketRange: [entry.start, entry.end]
      } : null
    };
  });
  if (new Set(winners.map(item => item.slot)).size !== winners.length || new Set(winners.map(item => item.ticketNumber)).size !== winners.length || winners.some(item => !item.participant)) throw new Error('Chainlink Surf winners do not match the locked ledger');
  let quote = null;
  if (state <= 1) {
    const wrapper = new Contract(WRAPPER, wrapperAbi, provider);
    const [disabled, fee] = await Promise.all([wrapper.s_disabled({
      blockTag: block
    }), provider.getFeeData()]);
    quote = fee.gasPrice ? await wrapper.estimateRequestPriceNative(200_000, 1, fee.gasPrice, {
      blockTag: block
    }) : 0n;
    if (disabled || quote <= 0n) throw new Error('Chainlink VRF direct funding is unavailable');
  }
  const resultId = requestId === 0n ? null : keccak256(AbiCoder.defaultAbiCoder().encode(['uint256', 'address', 'bytes32', 'bytes32', 'uint256'], [chainId, source, drawId, status.ledgerHash_, requestId]));
  return {
    provider,
    contract,
    resultsContract: contract,
    signer,
    block,
    chainId,
    drawId,
    state,
    sourceState,
    results: {
      ready: true,
      address: source,
      runtimeHash,
      resultId,
      bound: slots.length > 0,
      complete: sourceState === 4
    },
    ledgerMatch,
    requestId: requestId.toString(),
    source,
    runtimeHash,
    signerAddress: signer?.address || null,
    signerAdmin,
    totalTickets: Number(status.totalTickets_),
    prizeSlotCount: Number(status.prizeSlotCount_),
    ledgerHash: status.ledgerHash_,
    winnerCount: winners.length,
    winners,
    vrf: {
      provider: 'chainlink-v2.5',
      coordinatorAddress: COORDINATOR,
      wrapperAddress: WRAPPER,
      subscription: null,
      directPriceWei: quote?.toString() || null,
      callbackGasLimit: 200_000,
      confirmations: 3
    }
  };
}
