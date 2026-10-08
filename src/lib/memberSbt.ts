export type MemberSbtResult = {
  walletAddress: string;
  sbtBadgeCount: number;
  checkedAt: string;
};

export async function readMemberSbt(forceRefresh: boolean, signal: AbortSignal): Promise<MemberSbtResult> {
  const url = forceRefresh ? '/api/hub/member-sbt?refresh=1' : '/api/hub/member-sbt';
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal
  });
  if (!response.ok) throw new Error(`Member SBT endpoint returned ${response.status}.`);
  return (await response.json()) as MemberSbtResult;
}

// Count held badges, not token units. An account change invalidates old data.
export function readMemberBadgeCount(result: MemberSbtResult, wallet: string): number {
  const count = result.sbtBadgeCount;
  if (typeof result.walletAddress !== 'string' ||
    result.walletAddress.toLowerCase() !== wallet.toLowerCase() ||
    typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) {
    throw new Error('SBT badge count is missing, invalid, or belongs to another wallet.');
  }
  return count;
}
