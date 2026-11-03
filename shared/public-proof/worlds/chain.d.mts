import type { AbstractProvider } from 'ethers';
import type { EventAuthority, ProofCommitment, ChainFacts,ProofManifest } from '../types';
export const RUNTIME_HASH: string;
export const REGISTRY_RUNTIME_HASH: string;
export const MATCH_REGISTRY_RUNTIME_HASH: string;
export function supportedRuntime(hash: string): boolean;
export function collectChainFacts(provider: AbstractProvider, registry: EventAuthority, commitment: ProofCommitment, transactions: ChainFacts,manifest?:ProofManifest): Promise<ChainFacts>;
