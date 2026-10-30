import {isAddress,ZeroAddress} from 'ethers';
import {requireThat,same} from './protocol.mjs';

// The verifier's caller supplies the previously published authority. A bundle
// cannot choose the network on which its own contract should be trusted.
export function assertEventAuthority(bundle,registry){
  requireThat([56,97].includes(registry.chainId),'Supply the independently approved BSC chain ID (56 or 97).');
  requireThat(isAddress(registry.contract)&&!same(registry.contract,ZeroAddress),'Supply the independently approved event contract.');
  requireThat(bundle?.chain?.chainId===registry.chainId,'Proof chain differs from the independently approved chain.');
  requireThat(same(bundle.chain.contract,registry.contract),'Proof contract differs from the independently approved contract.');
}
