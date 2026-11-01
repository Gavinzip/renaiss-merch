# Worlds winner-only policy

New Worlds draws use committed policy version 2: one primary winner and zero
alternates for each match. The policy is in manifestHash; prizePlanHash and the
frozen ledger independently bind its role counts. The approved protocol/leaf
domain and deployed registry remain unchanged. The entire round must contain
at least three tickets to meet the existing contract constraint.

The campaign and verifier copies of `protocol.mjs` and `draw-policy.mjs` must be
byte-identical at release. New-policy mismatches or an extra alternate are
rejected. Legacy immutable proofs remain fully verifiable using their exact old
policy, including every historical path, without changing those bytes.

The public scene only creates the primary winner card. Raw historical evidence
may still contain original reserve picks; verifying those old records does not
create a reserve card or silently reinterpret the original draw.

This is a local preparation change. Release the campaign and verifier together
only after explicit Git push/deployment authorization. No chain transaction,
formal roster or published proof is created by these changes.
