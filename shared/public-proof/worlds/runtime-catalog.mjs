// Control-plane metadata only. Do not import the browser/CLI cryptographic
// implementation merely to validate an independently configured runtime pin.
import legacyBuild from './contract-build.json' with {type:'json'};
import registryBuild from './registry-build.json' with {type:'json'};

export const RUNTIME_HASH = legacyBuild.runtimeHash;
export const REGISTRY_RUNTIME_HASH = registryBuild.runtimeHash;
export const supportedRuntime = hash => typeof hash === 'string' &&
  [RUNTIME_HASH, REGISTRY_RUNTIME_HASH].some(value => value.toLowerCase() === hash.toLowerCase());
