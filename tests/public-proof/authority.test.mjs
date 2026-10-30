import test from 'node:test';
import assert from 'node:assert/strict';
import {assertEventAuthority} from '../../shared/public-proof/worlds/authority.mjs';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';

const contract='0x1111111111111111111111111111111111111111';
test('an identical address on a different chain cannot validate as the approved authority',()=>{
  const approved={chainId:56,contract};
  assert.doesNotThrow(()=>assertEventAuthority({chain:{chainId:56,contract}},approved));
  assert.throws(()=>assertEventAuthority({chain:{chainId:97,contract}},approved),/approved chain/);
  assert.throws(()=>assertEventAuthority({chain:{chainId:56,contract:'0x2222222222222222222222222222222222222222'}},approved),/approved contract/);
  assert.throws(()=>assertEventAuthority({chain:{chainId:56,contract}},{contract}),/chain ID/);
  assert.throws(()=>assertEventAuthority({chain:{chainId:56,contract}},{chainId:31337,contract}),/chain ID/);
});

test('the executable CLI rejects a bundle on testnet when mainnet was independently specified',async()=>{
  const server=createServer((_req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({chain:{chainId:97,contract}}));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const child=spawn(process.execPath,['scripts/verify-ecvrf.mjs',`http://127.0.0.1:${server.address().port}/bundle`,contract,'56'],{
      env:{...process.env,ECVRF_VERIFY_RPC:'http://127.0.0.1:1'},stdio:['ignore','pipe','pipe'],
    });
    let stdout='',stderr='';child.stdout.on('data',value=>stdout+=value);child.stderr.on('data',value=>stderr+=value);
    const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
    assert.equal(code,1);assert.equal(stdout,'');
    assert.equal(JSON.parse(stderr).verified,false);assert.match(JSON.parse(stderr).error,/approved chain/);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
