// Policy version is committed in manifestHash; the exact prize counts are also
// committed in prizePlanHash and the frozen source ledger. The leaf/VRF domain
// stays unchanged so the approved reusable contract remains valid.
export const POLICY=Object.freeze({version:2,primary:1,alternates:0,uniqueTicketsPerMatch:true,excludeOtherTicketsOfSamePerson:false});
export const LEGACY_POLICY=Object.freeze({primary:1,alternates:2,uniqueTicketsPerMatch:true,excludeOtherTicketsOfSamePerson:false});
export const MIN_COMMITTED_TICKETS=3;
export function selectionCountForPolicy(policy) {
  const expected=policy?.version===2?POLICY:LEGACY_POLICY;
  if(!policy||Object.keys(policy).length!==Object.keys(expected).length||Object.entries(expected).some(([key,value])=>policy[key]!==value))
    throw new Error('Unsupported committed draw policy.');
  return expected.primary*(1+expected.alternates);
}
