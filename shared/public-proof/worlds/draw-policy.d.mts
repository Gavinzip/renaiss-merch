export const POLICY: Readonly<{version:2;primary:1;alternates:0;uniqueTicketsPerMatch:true;excludeOtherTicketsOfSamePerson:false}>;
export const LEGACY_POLICY: Readonly<{primary:1;alternates:2;uniqueTicketsPerMatch:true;excludeOtherTicketsOfSamePerson:false}>;
export function selectionCountForPolicy(policy:unknown):number;
export const MIN_COMMITTED_TICKETS: 3;
