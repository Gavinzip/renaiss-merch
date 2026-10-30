import type { ProofBundle, EventAuthority, ChainFacts, VerificationCheck } from '../types';
export function createWorldsVerification(options: { bundle: ProofBundle; expectedBundleHash: string; authority: EventAuthority;
  readChain: (authority: EventAuthority, commitment: ProofBundle['commitment'], claimed: ChainFacts) => Promise<ChainFacts> }): { run(step: number): Promise<VerificationCheck> };
