import { mkdir, open, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Contract, Transaction, formatEther, getCreateAddress, keccak256 } from 'ethers';
import build from '../../shared/draw-results-contract.json' with { type: 'json' };
import { SURF_DRAW_ADDRESS, SURF_DRAW_CHAIN_ID, SURF_DRAW_RUNTIME_HASH } from './model.mjs';

const MAX_FEE = 200_000_000_000_000n; // 0.0002 BNB; deployment only, value is always zero.
async function writeDurably(file, value, exclusive = false) {
  const handle = await open(file, exclusive ? 'wx' : 'w', 0o600);
  try { await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`); await handle.sync(); }
  finally { await handle.close(); }
  const directory = await open(path.dirname(file), 'r');
  try { await directory.sync(); } finally { await directory.close(); }
}

// No HTTP route exposes this tool. A human-approved deployment supplies the
// exact reviewed compiler-input hash. Omission is read-only preflight.
export async function deployDrawResults({ provider, signer, journalDir, approvedInputHash = null }) {
  if (approvedInputHash !== null && approvedInputHash !== build.inputSha256) throw new Error('deployment_approval_mismatch');
  if (Number(await provider.send('eth_chainId', [])) !== SURF_DRAW_CHAIN_ID ||
      keccak256(await provider.getCode(SURF_DRAW_ADDRESS)) !== SURF_DRAW_RUNTIME_HASH) throw new Error('deployment_source_mismatch');
  const source = new Contract(SURF_DRAW_ADDRESS, ['function isAdmin(address) view returns(bool)'], provider);
  if (!signer || !await source.isAdmin(signer.address)) throw new Error('deployment_signer_not_authorized');
  let intent = null;
  const intentFile = journalDir && path.join(journalDir, 'signed-intent.json');
  if (intentFile) { try { intent = JSON.parse(await readFile(intentFile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  if (!intent || approvedInputHash === null) {
    const estimate = await provider.estimateGas({ from: signer.address, data: build.creationBytecode, value: 0n });
    const gasLimit = (estimate * 120n + 99n) / 100n;
    const fee = await provider.getFeeData();
    const block = await provider.getBlock('latest');
    if (!fee.gasPrice || !block || gasLimit >= block.gasLimit || gasLimit * fee.gasPrice > MAX_FEE) throw new Error('deployment_fee_cap_exceeded');
    if (await provider.getBalance(signer.address) < gasLimit * fee.gasPrice) throw new Error('deployment_gas_insufficient');
    const nonce = await provider.getTransactionCount(signer.address, 'pending');
    if (nonce !== await provider.getTransactionCount(signer.address, 'latest')) throw new Error('deployment_signer_nonce_busy');
    const preflight = { preflightOnly: true, chainId: SURF_DRAW_CHAIN_ID, signer: signer.address,
      gasLimit: gasLimit.toString(), maximumFeeBnb: formatEther(gasLimit * fee.gasPrice), feeCapBnb: formatEther(MAX_FEE),
      inputSha256: build.inputSha256, runtimeHash: build.runtimeHash };
    if (approvedInputHash === null) return preflight;
    if (!journalDir) throw new Error('deployment_journal_required');
    await mkdir(journalDir, { recursive: true, mode: 0o700 });
    const raw = await signer.signTransaction({ chainId: SURF_DRAW_CHAIN_ID, type: 0, nonce, value: 0n,
      data: build.creationBytecode, gasLimit, gasPrice: fee.gasPrice });
    intent = { raw, hash: keccak256(raw), nonce, from: signer.address, inputSha256: build.inputSha256,
      address: getCreateAddress({ from: signer.address, nonce }) };
    await writeDurably(intentFile, intent, true);
  }
  const signed = Transaction.from(intent.raw);
  if (intent.inputSha256 !== build.inputSha256 || keccak256(intent.raw) !== intent.hash || signed.from !== signer.address ||
      signed.chainId !== BigInt(SURF_DRAW_CHAIN_ID) || signed.to !== null || signed.value !== 0n || signed.data !== build.creationBytecode ||
      signed.gasLimit * signed.gasPrice > MAX_FEE || intent.address !== getCreateAddress({ from: signer.address, nonce: signed.nonce })) {
    throw new Error('deployment_saved_intent_mismatch');
  }
  let receipt = await provider.getTransactionReceipt(intent.hash);
  if (!receipt && !await provider.getTransaction(intent.hash)) {
    try { await provider.broadcastTransaction(intent.raw); } catch { /* Reconcile this same hash below. */ }
  }
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    receipt = await provider.getTransactionReceipt(intent.hash);
    if (receipt && Number(receipt.status) !== 1) throw new Error('deployment_transaction_reverted');
    if (receipt) {
      const [canonical, finalized] = await Promise.all([provider.getBlock(receipt.blockNumber), provider.getBlock('finalized')]);
      if (canonical?.hash === receipt.blockHash && finalized?.number >= receipt.blockNumber) break;
    }
    receipt = null;
    await new Promise(resolve => setTimeout(resolve, 800));
  }
  if (!receipt) throw new Error('deployment_pending_reconcile_saved_intent');
  if (receipt.contractAddress !== intent.address || keccak256(await provider.getCode(intent.address, receipt.blockNumber)) !== build.runtimeHash) {
    throw new Error('deployment_runtime_mismatch');
  }
  const report = { chainId: SURF_DRAW_CHAIN_ID, address: intent.address, transactionHash: intent.hash,
    blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed.toString(), runtimeHash: build.runtimeHash,
    inputSha256: build.inputSha256, source: SURF_DRAW_ADDRESS, sourceVerified: false };
  await writeDurably(path.join(journalDir, 'deployment.json'), report);
  return report;
}
