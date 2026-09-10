// User-selected policy: compare completed explorer and on-chain badge counts,
// and retain the larger result. Do not add them or maximize each token balance.
export const SBT_VERIFICATION_VERSION = 'dual-source-max-v1';

export function hasCurrentSbtVerification(result) {
  return result?.verificationVersion === SBT_VERIFICATION_VERSION;
}

export function summarizeSbtBalances(balances) {
  const values = Object.values(balances);
  if (values.some((value) => !Number.isSafeInteger(value) || value <= 0)) {
    throw new Error('sbt_balance_invalid');
  }
  const sbtBalance = values.reduce((total, value) => total + value, 0);
  if (!Number.isSafeInteger(sbtBalance)) throw new Error('sbt_balance_overflow');
  return { sbtBalance, sbtBadgeCount: values.length };
}

export function selectMaximumSbtResult(explorer, onchain) {
  const oldCount = summarizeSbtBalances(explorer.balances);
  const newCount = summarizeSbtBalances(onchain.balances);
  const selectedSource = oldCount.sbtBadgeCount > newCount.sbtBadgeCount ||
    (oldCount.sbtBadgeCount === newCount.sbtBadgeCount && oldCount.sbtBalance > newCount.sbtBalance)
    ? 'bscscan' : 'onchain';
  return {
    ...(selectedSource === 'bscscan' ? oldCount : newCount),
    verificationVersion: SBT_VERIFICATION_VERSION,
    source: 'dual_source_max',
    selectedSource,
    verifiedAt: new Date().toISOString(),
    sourceCounts: {
      bscscan: { ...oldCount, checkedAt: explorer.checkedAt, latestTransferBlock: explorer.latestTransferBlock },
      onchain: { ...newCount, checkedAt: onchain.checkedAt, blockNumber: onchain.blockNumber,
        maxTokenId: onchain.maxTokenId, catalogSource: onchain.catalogSource, catalogCheckedAt: onchain.catalogCheckedAt }
    }
  };
}
