import { useEffect, useRef } from 'react';
import type { AppLocale } from '../../../i18n/LocaleContext';
import type { LoadedProof, VerificationCheck } from '../../../../shared/public-proof/types';
import { proofCopy } from '../proofCopy';
import { ScrollProofStory } from './ScrollProofStory';
import type { ProofStoryData } from './ProofScenes';
import { ProofStep, ProofValue } from './CheckPrimitives';

type Props = { proof: LoadedProof; checks: VerificationCheck[]; ready: boolean; running: number | null;
  error: string | null; run: (step: number) => void; locale: AppLocale };

export function FairProofSequence({ proof, checks, ready, running, error, run, locale }: Props) {
  const attempted = useRef(new Set<number>());
  const copy = proofCopy[locale];
  const bundle = proof.bundle;
  const pick = bundle.result.picks[0];
  useEffect(() => {
    if (!ready || running !== null || error || checks.length >= 6) return;
    const next = checks.length + 1;
    if (!attempted.current.has(next)) { attempted.current.add(next); run(next); }
    // Each real browser check runs once. Scrolling only animates explanations.
  }, [ready, running, error, checks.length, run]);
  const role = (rank: number) => rank === 0 ? 'Winner' : `Reserve ${rank}`;
  const story: ProofStoryData = {
    verification: {
      transactionHash: bundle.chain.requestTx, chainId: bundle.chain.chainId,
      contractAddress: bundle.chain.contract, commitmentTransactionHash: bundle.chain.commitmentTx,
      roundId: bundle.commitment.roundId, stage: bundle.manifest.stage, bundleHash: proof.bundleHash,
      ticket: { ...pick, role: role(pick.rank), prizeName: bundle.manifest.matches.find(m => m.matchId === pick.matchId)!.prize.name },
      witness: { proof: bundle.proof, blockNumber: bundle.chain.requestBlockNumber }, merkleProof: pick.path,
    },
    completed: checks.length, working: running ?? 0,
    sealed: !Array.isArray(bundle.manifest.matches) || !Array.isArray(bundle.result.picks), error: error ?? '',
    facts: checks.length >= 1 ? { root: bundle.commitment.root, manifestHash: bundle.commitment.manifestHash,
      publicKey: bundle.commitment.publicKey, blockHash: bundle.chain.requestBlockHash, ticketCount: bundle.commitment.ticketCount } : null,
    seed: checks.length >= 2 ? bundle.alpha : null, beta: checks.length >= 3 ? bundle.beta : null,
    replay: checks.length >= 4 ? bundle.result : null, merkleRoot: checks.length >= 6 ? bundle.commitment.root : null,
  };
  return <section className="vf-result" aria-labelledby="vf-result-title">
    <div className="vf-result-header"><div><span>PUBLIC EVENT RECORD · BROWSER CHECKS BELOW</span>
      <h2 id="vf-result-title">The committed round and published tickets.</h2></div></div>
    <p className="vf-result-intro">Published data is not a verification verdict. This browser independently checks the approved chain, contract, ECVRF, original Worlds selector, winner and reserve order, and every Merkle inclusion.</p>
    <ScrollProofStory {...story} />
    <div className="vf-walkthrough">
      <div className="vf-walkthrough-top"><div><span className="vf-eyebrow">THE PROOF, STEP BY STEP</span><h2>Inspect every check.</h2>
        <p>The browser checks each available step. Hover a value for its origin; copy the complete value.</p></div>
        <div className="vf-source-legend" aria-label="Evidence sources"><span className="vf-source-chain">On-chain</span><span className="vf-source-published">Published data</span><span className="vf-source-browser">Computed here</span></div>
      </div>
      <ol className="vf-steps">{copy.steps.map(([title, description], index) => {
        const n = index + 1, check = checks[index];
        return <ProofStep key={n} number={n} title={title} description={description} action={copy.run}
          done={!!check} active={ready && checks.length === index} working={running === n} onAction={() => run(n)}>
          {check ? <div className="vf-value-grid">{check.chips.map((chip, i) => <ProofValue key={i}
            label={chip.label} value={chip.value} source={chip.source === 'onchain' ? 'chain' : chip.source === 'local' ? 'browser' : 'published'} note={chip.detail} />)}</div> : null}
        </ProofStep>;
      })}</ol>
      {error ? <p className="vf-step-error" role="alert">{error} No browser-verified result is shown. You can retry.</p> : null}
      {checks.length === 6 ? <div className="vf-all-verified" role="status"><div><strong>{copy.verified}</strong><span>{copy.boundary}</span></div></div> : null}
    </div>
  </section>;
}
