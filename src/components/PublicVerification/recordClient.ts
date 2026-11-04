import type { LoadedProof, ResolvedProofRecord } from '../../../shared/public-proof/types';
import { proofLocation, readProofOverview, readRoundProof } from './proofClient';

const hash32 = (value:unknown):value is string => typeof value==='string' && /^0x[0-9a-f]{64}$/i.test(value);
const same = (a:string,b:string) => a.toLowerCase()===b.toLowerCase();
export const worldsEvent = {id:'worlds-2026',name:'Worlds 2026',verifier:'worlds-ticket-ecvrf-v1'};
export class ProofLookupError extends Error {
  constructor(public code:string){super(code);}
}
export async function resolveProofRecord(target:ReturnType<typeof proofLocation>,signal:AbortSignal):Promise<ResolvedProofRecord> {
  const query=new URLSearchParams();
  if(target.tx)query.set('tx',target.tx);
  if(target.bundleHash)query.set('bundleHash',target.bundleHash);
  if(target.event)query.set('event',target.event);
  if(target.stage)query.set('stage',target.stage);
  const response=await fetch('/api/public-proofs/resolve?'+query,{cache:'no-store',signal});
  if(!response.ok){const body=await response.json().catch(()=>({}));throw new ProofLookupError(typeof body.code==='string'?body.code:'proof_lookup_unavailable');}
  const value=await response.json() as ResolvedProofRecord;
  if(!value.event || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.event.id) || typeof value.event.name!=='string' || value.event.name.length>160 ||
      !value.record || !['quarter','semi','final'].includes(value.record.stage))throw new ProofLookupError('proof_source_invalid');
  // This is a dispatcher, not a default. New protocols need their own reviewed
  // client/Worker adapter; an unknown event can never inherit Worlds authority.
  if(value.event.id!==worldsEvent.id || value.event.verifier!==worldsEvent.verifier)throw new ProofLookupError('proof_verifier_not_supported');
  if(target.event && value.event.id!==target.event || target.stage && value.record.stage!==target.stage)throw new ProofLookupError('proof_record_changed');
  const record=value.record;
  if(record.kind==='draw'){
    if(!hash32(record.tx)||!hash32(record.bundleHash)||!hash32(record.roundId)||
       target.bundleHash&&!same(target.bundleHash,record.bundleHash))throw new ProofLookupError('proof_record_changed');
  }else if(record.kind==='roster'){
    const groups={quarter:['qf-01','qf-02','qf-03','qf-04'],semi:['sf-01','sf-02'],final:['gf-01']};
    if(!groups[record.stage].includes(record.match)||!hash32(record.snapshotHash)||target.bundleHash)throw new ProofLookupError('proof_source_invalid');
  }else throw new ProofLookupError('proof_source_invalid');
  if(target.tx && (!record.transaction||!same(record.transaction,target.tx)))throw new ProofLookupError('proof_record_changed');
  return value;
}
export async function loadResolvedRecord(resolved:ResolvedProofRecord,signal:AbortSignal) {
  if(resolved.event.verifier!==worldsEvent.verifier||resolved.event.id!==worldsEvent.id)throw new ProofLookupError('proof_verifier_not_supported');
  const overview=await readProofOverview(signal),record=resolved.record;
  let proof:LoadedProof|null=null;
  if(record.kind==='draw'){
    proof=await readRoundProof(overview,record.stage,record.bundleHash,record.tx,signal);
    if(!proof || !same(proof.bundle.commitment.roundId,record.roundId) || record.transaction &&
      ![proof.bundle.chain.requestTx,proof.bundle.chain.commitmentTx].some(tx=>same(tx,record.transaction!)))throw new ProofLookupError('proof_record_changed');
  }
  return {overview,proof};
}
export function proofDownloadPath(proof:LoadedProof) {
  return `/api/public-proofs/worlds-2026/${proof.bundle.manifest.stage}/bundle?`+new URLSearchParams({bundleHash:proof.bundleHash,tx:proof.bundle.chain.requestTx,download:'1'});
}
