import type {AbstractProvider} from 'ethers';
import type {EventAuthority,ProofManifest} from '../types';
import type {MatchSnapshot,MatchChainFacts} from './match-types';
export const MATCH_ABI:string[];
export function inspectMatchCommitment(provider:AbstractProvider,authority:EventAuthority,snapshot:MatchSnapshot,options?:{beforeBlock?:number;transactionHash?:string}):Promise<{status:string;chain?:MatchChainFacts;transactionHash?:string}>;
export function verifyRoundMatchChain(provider:AbstractProvider,authority:EventAuthority,manifest:ProofManifest,beforeBlock?:number):Promise<void>;
