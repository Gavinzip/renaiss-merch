import {Contract,Interface,ZeroAddress,keccak256} from 'ethers';
import {PROTOCOL_HASH,requireThat,same} from './protocol.mjs';
import build from './contract-build.json' with {type:'json'};
import registryBuild from './registry-build.json' with {type:'json'};

export const ECVRF_ABI=[
  'function CAMPAIGN() view returns(bytes32)',
  'function PROTOCOL() view returns(bytes32)',
  'function owner() view returns(address)',
  'function admins(address) view returns(bool)',
  'function REGISTRY_VERSION() view returns(uint256)',
  'function roundCount() view returns(uint256)',
  'function roundIds(uint256) view returns(bytes32)',
  'function rounds(bytes32) view returns(bytes32 root,bytes32 manifestHash,bytes32 prizePlanHash,bytes32 publicKey,uint256 ticketCount,uint256 commitmentBlock,uint256 requestBlock)',
  'function commitRound(bytes32,bytes32,bytes32,bytes32,bytes32,uint256)',
  'function requestRound(bytes32)',
  'event RoundCommitted(bytes32 indexed roundId,bytes32 root,bytes32 manifestHash,bytes32 prizePlanHash,bytes32 publicKey,uint256 ticketCount,bytes32 protocolHash)',
  'event RoundRequested(bytes32 indexed roundId,uint256 requestBlock)',
];
export const RUNTIME_HASH=build.runtimeHash;
export const REGISTRY_RUNTIME_HASH=registryBuild.runtimeHash;
export const supportedRuntime=hash=>[RUNTIME_HASH,REGISTRY_RUNTIME_HASH].some(value=>same(value,hash));
const iface=new Interface(ECVRF_ABI);
export async function inspectRound(provider,registry,commitment){
  const [network,finalized,code]=await Promise.all([provider.getNetwork(),provider.getBlock('finalized'),provider.getCode(registry.contract)]);
  requireThat(Number(network.chainId)===registry.chainId&&finalized,'RPC network or finality is unavailable.');
  requireThat(supportedRuntime(registry.runtimeHash)&&same(keccak256(code),registry.runtimeHash),'Deployed contract code differs.');
  const contract=new Contract(registry.contract,ECVRF_ABI,provider),state=await contract.rounds(commitment.roundId);
  if(state.commitmentBlock===0n)return {status:'prepared'};
  for(const key of ['root','manifestHash','prizePlanHash','publicKey'])requireThat(same(state[key],commitment[key]),`On-chain ${key} differs.`);
  requireThat(state.ticketCount===BigInt(commitment.ticketCount),'On-chain ticket count differs.');
  const status=state.requestBlock>0n?(state.requestBlock<=BigInt(finalized.number)?'request_finalized':'request_pending'):(state.commitmentBlock<=BigInt(finalized.number)?'commitment_finalized':'commitment_pending');
  const result={status,commitmentBlock:Number(state.commitmentBlock),requestBlock:Number(state.requestBlock)};
  for(const [name,block,key] of [['RoundCommitted',state.commitmentBlock,'commitmentTx'],['RoundRequested',state.requestBlock,'requestTx']]){
    if(block===0n)continue;
    const logs=await provider.getLogs({address:registry.contract,fromBlock:Number(block),toBlock:Number(block),topics:[iface.getEvent(name).topicHash,commitment.roundId]});
    requireThat(logs.length===1,`Missing or duplicate ${name} history.`);result[key]=logs[0].transactionHash;
  }
  return result;
}
function oneEvent(receipt,address,name){
  const logs=receipt.logs.filter(l=>same(l.address,address)).flatMap(log=>{try{const e=iface.parseLog(log);return e?.name===name?[e]:[];}catch{return [];}});
  requireThat(logs.length===1,`Expected exactly one ${name} event.`);return logs[0].args;
}
/** Independently retrieves receipts/code/state at one finalized checkpoint. No API attestation is trusted. */
export async function collectChainFacts(provider,registry,commitment,transactions){
  requireThat(/^0x[0-9a-f]{40}$/i.test(registry.contract)&&!same(registry.contract,ZeroAddress),'Event contract is not configured.');
  requireThat(supportedRuntime(registry.runtimeHash),'Event registry uses an unreviewed contract build.');
  const [network,finalized]=await Promise.all([provider.getNetwork(),provider.getBlock('finalized')]);
  requireThat(Number(network.chainId)===registry.chainId&&finalized?.hash,'RPC network or finality is unavailable.');
  const contract=new Contract(registry.contract,ECVRF_ABI,provider);
  const [code,protocol,state,commitReceipt,requestReceipt]=await Promise.all([
    provider.getCode(registry.contract,finalized.number),contract.PROTOCOL({blockTag:finalized.number}),
    contract.rounds(commitment.roundId,{blockTag:finalized.number}),
    provider.getTransactionReceipt(transactions.commitmentTx),provider.getTransactionReceipt(transactions.requestTx),
  ]);
  requireThat(code!=='0x'&&same(keccak256(code),registry.runtimeHash)&&same(protocol,PROTOCOL_HASH),'Deployed contract code or protocol differs.');
  for(const receipt of [commitReceipt,requestReceipt])requireThat(receipt&&receipt.status===1&&same(receipt.to,registry.contract)&&receipt.blockNumber<=finalized.number,'Transaction is missing, reverted, wrong contract or not finalized.');
  requireThat(commitReceipt.blockNumber<requestReceipt.blockNumber,'Commitment must precede the request block.');
  const c=oneEvent(commitReceipt,registry.contract,'RoundCommitted'),r=oneEvent(requestReceipt,registry.contract,'RoundRequested');
  requireThat(same(c.roundId,commitment.roundId)&&same(r.roundId,commitment.roundId)&&same(c.protocolHash,PROTOCOL_HASH),'Receipt is for another round or protocol.');
  for(const key of ['root','manifestHash','prizePlanHash','publicKey'])requireThat(same(c[key],commitment[key])&&same(state[key],commitment[key]),`On-chain ${key} differs.`);
  requireThat(c.ticketCount===BigInt(commitment.ticketCount)&&state.ticketCount===c.ticketCount&&state.commitmentBlock===BigInt(commitReceipt.blockNumber)&&state.requestBlock===BigInt(requestReceipt.blockNumber)&&r.requestBlock===state.requestBlock,'On-chain count, commitment or request sequence differs.');
  const [commitBlock,requestBlock]=await Promise.all([provider.getBlock(commitReceipt.blockNumber),provider.getBlock(requestReceipt.blockNumber)]);
  requireThat(commitBlock&&requestBlock&&same(commitBlock.hash,commitReceipt.blockHash)&&same(requestBlock.hash,requestReceipt.blockHash),'Receipt block is no longer canonical.');
  return {chainId:registry.chainId,contract:registry.contract,runtimeHash:registry.runtimeHash,commitmentTx:commitReceipt.hash,requestTx:requestReceipt.hash,commitmentBlockNumber:commitReceipt.blockNumber,commitmentBlockHash:commitReceipt.blockHash,requestBlockNumber:requestReceipt.blockNumber,requestBlockHash:requestReceipt.blockHash};
}
