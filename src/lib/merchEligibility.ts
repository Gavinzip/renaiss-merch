export const MINIMUM_MERCH_SBT_BALANCE = 40;

export type MerchEligibilityResult = {
  minimumSbtBalance?: number;
  sbtBadgeCount?: number;
  walletAddress: string;
  sbtBalance: number;
  status: 'eligible' | 'unqualified';
};

export class EligibilitySourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EligibilitySourceError';
  }
}

export class EligibilityPendingError extends Error {
  code: string;
  walletAddress: string | null;

  constructor(code: string, walletAddress: string | null) {
    super(code);
    this.name = 'EligibilityPendingError';
    this.code = code;
    this.walletAddress = walletAddress;
  }
}

type EligibilityPayload = {
  code?: unknown;
  sbtBalance?: unknown;
  sbtCount?: unknown;
  sbt?: unknown;
  sbt_balance?: unknown;
  status?: unknown;
  walletAddress?: unknown;
  minimumSbtBalance?: unknown;
  sbtBadgeCount?: unknown;
};

const eligibilityStatuses = new Set(['eligible', 'unqualified']);

function readSbtBalance(payload: EligibilityPayload) {
  const rawBalance =
    payload.sbtBalance ?? payload.sbtCount ?? payload.sbt ?? payload.sbt_balance;
  const balance = Number(rawBalance);

  return Number.isFinite(balance) ? balance : null;
}

export async function checkMerchEligibility(): Promise<MerchEligibilityResult> {
  const endpoint =
    import.meta.env.VITE_MERCH_ELIGIBILITY_ENDPOINT || '/api/merch-eligibility';
  const url = new URL(endpoint, window.location.origin);

  const response = await fetch(url, {
    headers: { Accept: 'application/json' }
  });
  const payload = (await response.json()) as EligibilityPayload;

  if (response.status === 501 || payload.status === 'pending') {
    throw new EligibilityPendingError(
      typeof payload.code === 'string'
        ? payload.code
        : 'eligibility_rule_not_configured',
      typeof payload.walletAddress === 'string' ? payload.walletAddress : null
    );
  }

  if (response.status === 409) {
    throw new EligibilityPendingError(
      typeof payload.code === 'string' ? payload.code : 'safe_wallet_not_ready',
      null
    );
  }

  if (!response.ok) {
    throw new EligibilitySourceError(
      `Eligibility source returned ${response.status}.`
    );
  }

  const sbtBalance = readSbtBalance(payload);

  if (sbtBalance === null) {
    throw new EligibilitySourceError(
      'Eligibility source did not include an SBT balance.'
    );
  }

  const walletAddress =
    typeof payload.walletAddress === 'string' ? payload.walletAddress : null;

  if (!walletAddress) {
    throw new EligibilitySourceError(
      'Eligibility source did not include a wallet address.'
    );
  }

  const sbtBadgeCount = readOptionalNumber(payload.sbtBadgeCount);

  return {
    minimumSbtBalance: readOptionalNumber(payload.minimumSbtBalance),
    sbtBadgeCount,
    walletAddress,
    sbtBalance,
    status: readEligibilityStatus(payload.status, sbtBalance, sbtBadgeCount)
  };
}

export function getVerifiedSbtCount(result: MerchEligibilityResult) {
  return Number.isFinite(result.sbtBadgeCount)
    ? Number(result.sbtBadgeCount)
    : result.sbtBalance;
}

function readOptionalNumber(value: unknown) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function readEligibilityStatus(
  value: unknown,
  sbtBalance: number,
  sbtBadgeCount?: number
) {
  if (typeof value === 'string' && eligibilityStatuses.has(value)) {
    return value as MerchEligibilityResult['status'];
  }

  return (sbtBadgeCount ?? sbtBalance) >= MINIMUM_MERCH_SBT_BALANCE
    ? 'eligible'
    : 'unqualified';
}
