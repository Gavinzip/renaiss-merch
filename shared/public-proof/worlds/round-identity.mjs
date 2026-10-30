import {AbiCoder,keccak256,toUtf8Bytes} from 'ethers';

const domain=keccak256(toUtf8Bytes('renaiss-ecvrf-round-v2'));
const abi=AbiCoder.defaultAbiCoder();
export function registryRoundId(identity){
  if(identity?.version!==2 || !/^[a-z0-9][a-z0-9._:-]{0,127}$/.test(identity.eventId??'') ||
      !/^[a-z0-9][a-z0-9._:-]{0,63}$/.test(identity.stage??'') ||
      !Number.isSafeInteger(identity.sequence) || identity.sequence<1)
    throw new Error('Invalid versioned event round identity.');
  return keccak256(abi.encode(['bytes32','bytes32','bytes32','uint256'],
    [domain,keccak256(toUtf8Bytes(identity.eventId)),keccak256(toUtf8Bytes(identity.stage)),identity.sequence]));
}
