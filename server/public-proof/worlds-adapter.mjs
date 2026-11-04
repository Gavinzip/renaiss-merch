import { FetchRequest, Interface, JsonRpcProvider, keccak256, toUtf8Bytes } from 'ethers';
import { HttpError } from '../http.mjs';
import { stages, worldsProofConfig } from './config.mjs';
import { readProofIndex } from './source.mjs';

const hash32 = value => typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value);
const same = (a,b) => typeof a==='string' && typeof b==='string' && a.toLowerCase()===b.toLowerCase();
const events = new Interface([
  'event RoundCommitted(bytes32 indexed roundId,bytes32 root,bytes32 manifestHash,bytes32 prizePlanHash,bytes32 publicKey,uint256 ticketCount,bytes32 protocolHash)',
  'event RoundRequested(bytes32 indexed roundId,uint256 requestBlock)',
  'event MatchCommitted(bytes32 indexed matchKey,bytes32 root,bytes32 snapshotHash,bytes32 publicKey,uint256 ticketCount,bytes32 protocolHash)',
]);
const matches = {quarter:['qf-01','qf-02','qf-03','qf-04'],semi:['sf-01','sf-02'],final:['gf-01']};

const publicProvider = source => {
  const request=new FetchRequest(source.publicRpc);request.timeout=8000;
  return new JsonRpcProvider(request,undefined,{batchMaxCount:1});
};
export async function readApprovedTransaction(authorities, tx, providerFor=publicProvider) {
  const chains=[...new Map(authorities.map(a=>[`${a.chainId}:${new URL(a.publicRpc).href}`,a])).values()];
  const records=await Promise.all(chains.map(async source=>{
    const provider=providerFor(source);
    try {
      const [network,receipt]=await Promise.all([provider.getNetwork(),provider.getTransactionReceipt(tx)]);
      if(Number(network.chainId)!==source.chainId)throw new Error('Wrong RPC network');
      if(!receipt)return null;
      const authority=authorities.find(a=>a.chainId===source.chainId && same(a.contract,receipt.to));
      if(!authority)return null;
      const finalized=await provider.getBlock('finalized');
      if(receipt.status!==1 || !finalized || receipt.blockNumber>finalized.number)throw new HttpError(409,'proof_transaction_not_finalized');
      // Use the same finalized checkpoint as the independent browser verifier.
      // Ordinary public nodes need not retain historical account-state snapshots.
      const [code,block]=await Promise.all([provider.getCode(authority.contract,finalized.number),provider.getBlock(receipt.blockNumber)]);
      if(!same(block?.hash,receipt.blockHash))throw new HttpError(409,'proof_transaction_not_finalized');
      if(!same(keccak256(code),authority.runtimeHash))throw new HttpError(409,'proof_authority_mismatch');
      const logs=receipt.logs.filter(l=>same(l.address,authority.contract)).flatMap(log=>{
        try { const event=events.parseLog(log);return event?[event]:[]; } catch { return []; }
      });
      if(logs.length!==1)return null;
      const event=logs[0];
      const identity={chainId:authority.chainId,contract:authority.contract.toLowerCase(),blockHash:receipt.blockHash,tx};
      if(event.name==='MatchCommitted')return {...identity,kind:'roster',matchKey:event.args.matchKey,snapshotHash:event.args.snapshotHash};
      return {...identity,kind:'draw',roundId:event.args.roundId};
    } catch(error) { if(error instanceof HttpError)throw error;throw new HttpError(502,'proof_lookup_unavailable'); }
    finally {provider.destroy();}
  }));
  const found=[...new Map(records.filter(Boolean).map(record=>[JSON.stringify(record).toLowerCase(),record])).values()];
  if(found.length>1)throw new HttpError(409,'proof_identity_ambiguous');
  return found[0]??null;
}

export function createWorldsProofAdapter({environment=process.env,fetchPublic=fetch,readTransaction=readApprovedTransaction}={}) {
  return { event:{id:'worlds-2026',name:'Worlds 2026',verifier:'worlds-ticket-ecvrf-v1'}, async resolve(selector) {
    const {origin,authorities}=worldsProofConfig(environment);
    if(!origin)throw new HttpError(503,'proof_source_not_configured');
    const candidates=selector.stage ? stages.filter(s=>s===selector.stage) : stages;
    if(!candidates.length)return null;
    const histories=await Promise.all(candidates.map(async stage=>{
      const history=await readProofIndex(origin,`/api/ecvrf/rounds/${stage}/history`,fetchPublic);
      if(history.stage!==stage || !Array.isArray(history.rounds) || history.rounds.length>10000 || history.rounds.some(r=>!r || r.stage!==stage || !hash32(r.roundId) ||
          (r.status==='published' && (!hash32(r.requestTx)||!hash32(r.bundleHash)))))throw new HttpError(502,'proof_history_invalid');
      return history.rounds;
    }));
    const rows=histories.flat();
    if(selector.tx&&selector.bundleHash&&rows.some(r=>same(r.requestTx,selector.tx)&&r.status==='published'&&!same(r.bundleHash,selector.bundleHash)))throw new HttpError(409,'proof_record_changed');
    const exact=rows.filter(r=>(!selector.tx||same(r.requestTx,selector.tx))&&(!selector.bundleHash||same(r.bundleHash,selector.bundleHash)));
    let found=exact,transaction=null;
    if(!found.length && selector.tx){
      transaction=await readTransaction(authorities,selector.tx);
      if(transaction?.kind==='roster'){
        if(selector.bundleHash)return null;
        for(const stage of candidates)for(const match of matches[stage])if(same(keccak256(toUtf8Bytes(`worlds-2026:${match}`)),transaction.matchKey))return {kind:'roster',stage,match,snapshotHash:transaction.snapshotHash,transaction:selector.tx};
        return null;
      }
      if(transaction?.roundId){
        const sameRound=rows.filter(r=>same(r.roundId,transaction.roundId));
        if(selector.bundleHash&&sameRound.some(r=>r.status==='published'&&!same(r.bundleHash,selector.bundleHash)))throw new HttpError(409,'proof_record_changed');
        found=sameRound.filter(r=>!selector.bundleHash||same(r.bundleHash,selector.bundleHash));
      }
    }
    if(found.length>1)throw new HttpError(409,'proof_identity_ambiguous');
    if(!found.length){if(transaction)throw new HttpError(409,'proof_not_published');return null;}
    const record=found[0];
    if(record.status!=='published')throw new HttpError(409,'proof_not_published');
    return {kind:'draw',stage:record.stage,tx:record.requestTx,bundleHash:record.bundleHash,roundId:record.roundId,...(selector.tx?{transaction:selector.tx}:{})};
  } };
}
