import {Contract,Interface,keccak256} from 'ethers';
import {MATCH_PROTOCOL_HASH,matchCommitmentFor} from './match-snapshot.mjs';
import {requireThat,same,canonical} from './protocol.mjs';
import v3 from './registry-v3-build.json' with {type:'json'};

export const MATCH_ABI=[
  'function REGISTRY_VERSION() view returns(uint256)',
  'function MATCH_PROTOCOL() view returns(bytes32)',
  'function owner() view returns(address)',
  'function admins(address) view returns(bool)',
  'function committers(address) view returns(bool)',
  'function setCommitter(address,bool)',
  'function matchRosters(bytes32) view returns(bytes32 root,bytes32 snapshotHash,bytes32 publicKey,uint256 ticketCount,uint256 commitmentBlock)',
  'function commitMatch(bytes32,bytes32,bytes32,bytes32,uint256)',
  'event MatchCommitted(bytes32 indexed matchKey,bytes32 root,bytes32 snapshotHash,bytes32 publicKey,uint256 ticketCount,bytes32 protocolHash)',
];
const iface=new Interface(MATCH_ABI);
export async function inspectMatchCommitment(provider,authority,snapshot,{beforeBlock,transactionHash}={}){
  const [network,finalized]=await Promise.all([provider.getNetwork(),provider.getBlock('finalized')]);
  requireThat(Number(network.chainId)===authority.chainId&&finalized?.hash,'Match chain or finalized checkpoint is unavailable.');
  requireThat(same(authority.runtimeHash,v3.runtimeHash),'Per-match commitments require the reviewed v3 registry.');
  const contract=new Contract(authority.contract,MATCH_ABI,provider),c=matchCommitmentFor(snapshot);
  const [code,version,protocol,state]=await Promise.all([provider.getCode(authority.contract,finalized.number),contract.REGISTRY_VERSION({blockTag:finalized.number}),contract.MATCH_PROTOCOL({blockTag:finalized.number}),contract.matchRosters(c.matchKey)]);
  requireThat(same(keccak256(code),v3.runtimeHash)&&version===3n&&same(protocol,MATCH_PROTOCOL_HASH),'Match registry runtime or protocol differs.');
  if(state.commitmentBlock===0n)return {status:'prepared'};
  for(const k of ['root','snapshotHash','publicKey'])requireThat(same(state[k],c[k]),`On-chain match ${k} differs.`);
  requireThat(state.ticketCount===BigInt(c.ticketCount),'On-chain match ticket count differs.');
  const blockNumber=Number(state.commitmentBlock);
  const logs=await provider.getLogs({address:authority.contract,fromBlock:blockNumber,toBlock:blockNumber,topics:[iface.getEvent('MatchCommitted').topicHash,c.matchKey]});
  requireThat(logs.length===1,'Missing or duplicate match commitment event.');
  const hash=logs[0].transactionHash;
  if(transactionHash)requireThat(same(hash,transactionHash),'Match commitment transaction differs.');
  if(blockNumber>finalized.number)return {status:'pending',transactionHash:hash};
  requireThat(beforeBlock===undefined||blockNumber<beforeBlock,'Match roster was not finalized before the round commitment.');
  const [receipt,block]=await Promise.all([provider.getTransactionReceipt(hash),provider.getBlock(blockNumber)]);
  requireThat(receipt?.status===1&&same(receipt.to,authority.contract)&&receipt.blockNumber===blockNumber&&same(receipt.blockHash,block?.hash),'Match commitment receipt is invalid or reorganized.');
  const event=iface.parseLog(logs[0]).args;
  requireThat(same(event.matchKey,c.matchKey)&&same(event.protocolHash,MATCH_PROTOCOL_HASH),'Match commitment event identity differs.');
  for(const k of ['root','snapshotHash','publicKey'])requireThat(same(event[k],c[k]),`Match event ${k} differs.`);
  requireThat(event.ticketCount===BigInt(c.ticketCount),'Match event ticket count differs.');
  return {status:'finalized',chain:{chainId:authority.chainId,contract:authority.contract,runtimeHash:authority.runtimeHash,commitmentTx:hash,commitmentBlockNumber:blockNumber,commitmentBlockHash:block.hash,committedAt:new Date(block.timestamp*1000).toISOString()}};
}
export async function verifyRoundMatchChain(provider,authority,manifest,beforeBlock){
  const {validateRoundSnapshots}=await import('./match-snapshot.mjs');validateRoundSnapshots(manifest);
  for(const anchor of manifest.matchSnapshots){
    const result=await inspectMatchCommitment(provider,authority,anchor.snapshot,{beforeBlock,transactionHash:anchor.chain.commitmentTx});
    requireThat(result.status==='finalized'&&canonical(result.chain)===canonical(anchor.chain),'Early match chain evidence differs.');
  }
}
