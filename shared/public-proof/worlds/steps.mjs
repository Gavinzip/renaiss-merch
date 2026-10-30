import { buildTicketTree, canonical, commitmentFor, deriveAlpha, digest, requireThat, same,
  selectTickets, validateManifest, verifiedBeta, verifyBundle, verifyInclusion } from './protocol.mjs';
import { assertEventAuthority } from './authority.mjs';

const chip = (label, value, source, detail) => ({ label, value: String(value), source, detail });
// UI steps are a presentation adapter over the unmodified, reviewed Worlds
// core. No chain result, winner, leaf or random-selection algorithm is invented.
export function createWorldsVerification({ bundle, expectedBundleHash, authority, readChain }) {
  let completed = 0, facts, tree, alpha, beta, result;
  return { async run(step) {
    requireThat(Number.isInteger(step) && step === completed + 1 && step <= 6, 'Run verification steps in order.');
    let chips;
    if (step === 1) {
      requireThat(authority?.configured, '本活動尚未獨立設定並核准承諾合約與公開 RPC。');
      assertEventAuthority(bundle, authority);
      requireThat(same(digest(bundle), expectedBundleHash), 'Proof bundle hash mismatch.');
      validateManifest(bundle.manifest); tree = buildTicketTree(bundle.manifest);
      const computed = commitmentFor(bundle.manifest, tree);
      for (const [key, value] of Object.entries(computed)) requireThat(typeof value === 'string'
        ? same(value, bundle.commitment[key]) : value === bundle.commitment[key], `Commitment mismatch: ${key}`);
      facts = await readChain(authority, bundle.commitment, bundle.chain);
      for (const [key, value] of Object.entries(facts)) requireThat(typeof value === 'number'
        ? value === bundle.chain[key] : same(value, bundle.chain[key]), `Chain evidence differs: ${key}`);
      chips = [chip('chain', facts.chainId, 'onchain', 'Network read independently from the configured public RPC.'),
        chip('contract', facts.contract, 'onchain', 'Reviewed runtime and protocol at one finalized checkpoint.'),
        chip('request tx', facts.requestTx, 'onchain', 'Successful finalized RoundRequested receipt for this round.'),
        chip('block hash', facts.requestBlockHash, 'onchain', 'Canonical finalized request block, after the commitment.'),
        chip('root', tree.root, 'local', 'Every ticket leaf rebuilt using the Worlds six-word ABI encoding.')];
    } else if (step === 2) {
      alpha = deriveAlpha(bundle.commitment, facts);
      requireThat(same(alpha, bundle.alpha), 'Published alpha differs from recomputation.');
      chips = [chip('α', alpha, 'local', 'Worlds deriveAlpha: protocol, chain, contract, round, root, manifest, prize plan, count, key and finalized request block.'),
        chip('round', bundle.commitment.roundId, 'onchain', 'RoundCommitted and RoundRequested refer to this same round.')];
    } else if (step === 3) {
      beta = verifiedBeta(bundle.commitment.publicKey, alpha, bundle.proof);
      requireThat(same(beta, bundle.beta), 'Published beta differs from recomputation.');
      chips = [chip('PK', bundle.commitment.publicKey, 'onchain', 'Public key fixed by the finalized pre-request commitment.'),
        chip('π', bundle.proof, 'api', 'The published 80-byte ECVRF witness; not a server verification attestation.'),
        chip('β', beta, 'local', 'RFC 9381 ECVRF-EDWARDS25519-SHA512-ELL2 verified in this browser.')];
    } else if (step === 4) {
      result = selectTickets(bundle.manifest, beta, tree);
      requireThat(canonical(result) === canonical(bundle.result), 'Winner, reserve order or Merkle paths differ.');
      requireThat(same(digest(result), bundle.resultHash), 'Result hash mismatch.');
      chips = [chip('stream', 'SHA-512(β ‖ uint256BE(counter))', 'local', '512-bit rejection sampling, forward partial Fisher–Yates; the original Worlds protocol is unchanged.'),
        chip('words', result.wordsConsumed, 'local', 'Counter advances on every stream word, including rejections.'),
        chip('result hash', digest(result), 'local', 'Canonical result digest, compared against the published result.')];
    } else if (step === 5) {
      chips = result.picks.map(pick => chip(`${pick.matchId} · ${pick.rank === 0 ? 'winner' : `reserve ${pick.rank}`}`,
        `#${pick.ticketNumber}`, 'local', 'Derived from committed ticket order. One winner, two ordered reserves; no ticket repeats within a match.'));
    } else {
      for (const pick of result.picks) requireThat(verifyInclusion(pick, pick.path, tree.root, bundle.commitment.roundId), 'Ticket Merkle inclusion failed.');
      const verified = verifyBundle(bundle, expectedBundleHash, tree);
      chips = [chip('root', verified.root, 'local', 'All selected six-word ticket leaves fold through sorted Keccak pairs to the independently checked on-chain root.'),
        chip('bundle hash', verified.bundleHash, 'local', 'Recomputed complete canonical proof bundle SHA-256.'),
        chip('inclusions', result.picks.length, 'local', 'Every winner and reserve path independently verified.')];
    }
    completed = step;
    return { step, chips, ...(step >= 5 ? { picks: result.picks } : {}) };
  } };
}
