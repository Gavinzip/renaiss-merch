export type ProofStage = 'quarter' | 'semi' | 'final';
export type ProofView = 'walkthrough' | 'story' | 'flow';
export type ProofPick = { matchId: string; ticketNumber: number; participantId: string; position: number; rank: number; positionType: string; path: string[] };
export type ProofManifest = {
  protocol: string; campaignId: string; stage: ProofStage; roundId: string;
  matches: { matchId: string; totalTickets: number; prize: { name: string }; entries: unknown[] }[];
  [key: string]: unknown;
};
export type ProofCommitment = { roundId: string; root: string; manifestHash: string; prizePlanHash: string; publicKey: string; ticketCount: number; protocolHash: string };
export type ChainFacts = { chainId: number; contract: string; runtimeHash: string; commitmentTx: string; requestTx: string; commitmentBlockNumber: number; commitmentBlockHash: string; requestBlockNumber: number; requestBlockHash: string };
export type ProofBundle = { protocol: string; manifest: ProofManifest; commitment: ProofCommitment; chain: ChainFacts; alpha: string; proof: string; beta: string; result: { picks: ProofPick[]; wordsConsumed: string }; resultHash: string; publishedAt: string };
export type EventAuthority = { configured: boolean; chainId: number | null; contract: string | null; runtimeHash: string; publicRpc: string | null; reason: string | null; context?: 'event' | 'rehearsal' };
export type ProofRound = { stage: ProofStage; name: string; roundId: string; status: string; bundleHash: string | null; publishedAt: string | null; proofUrl: string | null };
export type ProofOverview = { event: 'worlds-2026'; authority: EventAuthority; authorities: EventAuthority[]; rounds: ProofRound[] };
export type VerificationCheck = { step: number; chips: { label: string; value: string; source: 'onchain' | 'api' | 'local'; detail: string }[]; picks?: ProofPick[] };
export type LoadedProof = { bundle: ProofBundle; bundleHash: string; authority: EventAuthority };
