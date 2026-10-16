import { Interface, Transaction, getAddress, keccak256 } from 'ethers';
import { HttpError } from '../http.mjs';
import { drawAbi, readSurfChain } from './chain.mjs';
import { resultsAbi, surfResultId } from './results.mjs';
import chainlinkBuild from '../../shared/chainlink-surf-contract.json' with { type: 'json' };
import { SURF_CHAINLINK_DRAW_ID, SURF_DRAW_ADDRESS, SURF_DRAW_CHAIN_ID } from './model.mjs';

const resultsInterface = new Interface(resultsAbi);
const drawInterface = new Interface(drawAbi);
const chainlinkInterface = new Interface(chainlinkBuild.abi);
export function assertSurfTransactionTarget(record) {
  let tx, target;
  try {
    tx = Transaction.from(record.signed_raw);
    target = record.draw_id === SURF_CHAINLINK_DRAW_ID
      ? getAddress(process.env.SURF_CHAINLINK_SOURCE_ADDRESS || '')
      : record.action.startsWith('reveal:') ? getAddress(process.env.SURF_DRAW_RESULTS_ADDRESS || '') : SURF_DRAW_ADDRESS;
  } catch { throw new HttpError(409, 'draw_transaction_target_invalid'); }
  const payableRequest = record.draw_id === SURF_CHAINLINK_DRAW_ID && record.action === 'request';
  if (tx.to !== target || tx.chainId !== BigInt(SURF_DRAW_CHAIN_ID) ||
      (payableRequest ? tx.value <= 0n || tx.value > 2_000_000_000_000_000n : tx.value !== 0n) ||
      keccak256(record.signed_raw) !== record.tx_hash) throw new HttpError(409, 'draw_transaction_target_invalid');
  if (record.draw_id) {
    try {
      const parsed = record.draw_id === SURF_CHAINLINK_DRAW_ID
        ? chainlinkInterface.parseTransaction({ data: tx.data })
        : record.action.startsWith('reveal:')
        ? resultsInterface.parseTransaction({ data: tx.data })
        : drawInterface.parseTransaction({ data: tx.data });
      if (!parsed || parsed.args.drawId !== record.draw_id) throw new Error('wrong draw ID');
    } catch { throw new HttpError(409, 'draw_transaction_target_invalid'); }
  }
  return tx;
}

export async function verifySurfRevealReceipt(record, receipt, snapshot, provider) {
  const tx = assertSurfTransactionTarget(record);
  const chainlink = record.draw_id === SURF_CHAINLINK_DRAW_ID;
  const iface = chainlink ? chainlinkInterface : resultsInterface;
  const decoded = iface.parseTransaction({ data: tx.data });
  if (!snapshot || !decoded || decoded.name !== 'revealPrizeSlots' || decoded.args.drawId !== snapshot.draw_id ||
      decoded.args.expectedLedgerHash !== snapshot.ledger_hash || receipt.hash !== record.tx_hash ||
      receipt.to !== tx.to || Number(receipt.status) !== 1) throw new HttpError(409, 'draw_reveal_receipt_invalid');
  const expectedSlots = record.action.slice('reveal:'.length).split(',').map(Number);
  const actualSlots = chainlink ? decoded.args.slots : decoded.args.prizeSlots;
  if (actualSlots.length !== expectedSlots.length || actualSlots.some((slot, i) => Number(slot) !== expectedSlots[i])) {
    throw new HttpError(409, 'draw_reveal_receipt_invalid');
  }
  const resultId = chainlink ? null : surfResultId(snapshot.ledger_hash, decoded.args.expectedRequestId, snapshot.draw_id);
  const events = receipt.logs.filter(log => log.address.toLowerCase() === tx.to.toLowerCase()).flatMap(log => {
    try { const event = iface.parseLog(log); return event?.name === 'PrizeRevealed' ? [event] : []; }
    catch { return []; }
  });
  if (events.length !== expectedSlots.length || events.some((event, i) =>
      (!chainlink && event.args.resultId !== resultId) || event.args.drawId !== snapshot.draw_id ||
      Number(event.args.slot) !== expectedSlots[i])) throw new HttpError(409, 'draw_reveal_receipt_invalid');
  const chain = await readSurfChain(snapshot, { provider, includeSigner: false, includeSubscription: false, blockNumber: receipt.blockNumber });
  if ((!chainlink && chain.results.resultId !== resultId) || chain.requestId !== decoded.args.expectedRequestId.toString() || events.some(event =>
    !chain.winners.some(winner => winner.slot === Number(event.args.slot) && winner.ticketNumber === Number(event.args.ticketNumber)))) {
    throw new HttpError(409, 'draw_reveal_receipt_invalid');
  }
}
