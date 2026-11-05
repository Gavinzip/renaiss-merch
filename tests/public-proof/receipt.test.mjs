import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface,ZeroHash} from 'ethers';
import {receiptForCall} from '../../shared/public-proof/worlds/receipt.mjs';

const address='0x'+'11'.repeat(20),hash='0x'+'22'.repeat(32),blockHash='0x'+'33'.repeat(32),key='0x'+'44'.repeat(32);
const iface=new Interface(['function requestRound(bytes32)']);
const receipt={hash,status:1,to:address,blockNumber:42,blockHash,logs:[]};
function provider({transactions=[{to:address,data:iface.encodeFunctionData('requestRound',[key]),hash}],value=receipt}={}){
 return {async getBlock(n,prefetch){assert.equal(n,42);return {hash:blockHash,prefetchedTransactions:transactions};},async getTransactionReceipt(h){assert.equal(h,hash);return value;},async getLogs(){throw Error('Event search is unavailable.');}};
}
test('a pinned transaction is checked by receipt without a block-wide event search',async()=>{
 const p=provider();p.getBlock=async(n,prefetch)=>{assert.equal(prefetch,false);return {hash:blockHash};};
 assert.equal((await receiptForCall(p,address,42,iface,'requestRound',key,hash)).receipt.hash,hash);
});
test('recovery finds the exact contract call in the committed block without eth_getLogs',async()=>{
 assert.equal((await receiptForCall(provider(),address,42,iface,'requestRound',key)).receipt.hash,hash);
 for(const transactions of [[],[{to:address,data:iface.encodeFunctionData('requestRound',[ZeroHash]),hash}],Array(2).fill({to:address,data:iface.encodeFunctionData('requestRound',[key]),hash})])
  await assert.rejects(receiptForCall(provider({transactions}),address,42,iface,'requestRound',key),/Missing or duplicate/);
});
test('a reverted, swapped, wrong-contract, wrong-block, missing or reorganized receipt is rejected',async()=>{
 for(const value of [null,{...receipt,status:0},{...receipt,hash:ZeroHash},{...receipt,to:'0x'+'55'.repeat(20)},{...receipt,blockNumber:43},{...receipt,blockHash:ZeroHash}])
  await assert.rejects(receiptForCall(provider({value}),address,42,iface,'requestRound',key,hash),/invalid or reorganized/);
});
