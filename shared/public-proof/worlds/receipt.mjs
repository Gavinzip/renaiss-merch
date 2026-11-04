import {requireThat,same} from './protocol.mjs';

// State fixes the exact block. A pinned hash reads its receipt directly;
// recovery discovers the one matching call in that block, without eth_getLogs.
export async function receiptForCall(provider,address,blockNumber,iface,method,key,transactionHash){
  const block=await provider.getBlock(blockNumber,!transactionHash);
  requireThat(block?.hash,'Commitment block is unavailable.');
  if(!transactionHash){
    const calls=block.prefetchedTransactions.filter(tx=>{
      if(!same(tx.to,address))return false;
      try{return same(iface.decodeFunctionData(method,tx.data)[0],key);}catch{return false;}
    });
    requireThat(calls.length===1,'Missing or duplicate commitment transaction.');
    transactionHash=calls[0].hash;
  }
  const receipt=await provider.getTransactionReceipt(transactionHash);
  requireThat(receipt?.status===1&&same(receipt.hash,transactionHash)&&same(receipt.to,address)&&receipt.blockNumber===blockNumber&&same(receipt.blockHash,block.hash),'Commitment receipt is invalid or reorganized.');
  return {receipt,block};
}
