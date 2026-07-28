import type { MerchProductId } from './merchProducts';

export type MerchRevealDetails = {
  category: string;
  claimName: string;
  description: string;
  hasReverseVideo: boolean;
  requiresSize: boolean;
  statusEyebrow: string;
};

type MerchEligibilityBase = {
  minimumSbtBalance: number;
  sbtBadgeCount?: number;
  walletAddress: string;
  sbtBalance: number;
};

export type MerchEligibilityResult = MerchEligibilityBase &
  (
    | {
        reveal: MerchRevealDetails;
        status: 'eligible';
      }
    | {
        reveal?: never;
        status: 'unqualified';
      }
  );

export type EligibleMerchEligibilityResult = Extract<
  MerchEligibilityResult,
  { status: 'eligible' }
>;

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

export type EligibilityPayload = {
  code?: unknown;
  sbtBalance?: unknown;
  sbtCount?: unknown;
  sbt?: unknown;
  sbt_balance?: unknown;
  status?: unknown;
  walletAddress?: unknown;
  minimumSbtBalance?: unknown;
  reveal?: unknown;
  sbtBadgeCount?: unknown;
};

const eligibilityStatuses = new Set(['eligible', 'unqualified']);

function readSbtBalance(payload: EligibilityPayload) {
  const rawBalance =
    payload.sbtBalance ?? payload.sbtCount ?? payload.sbt ?? payload.sbt_balance;
  const balance = Number(rawBalance);

  return Number.isFinite(balance) ? balance : null;
}

export async function checkMerchEligibility(
  productId: MerchProductId = 'shirt'
): Promise<MerchEligibilityResult> {
  const endpoint =
    import.meta.env.VITE_MERCH_ELIGIBILITY_ENDPOINT || '/api/merch-eligibility';
  const url = new URL(endpoint, window.location.origin);
  url.searchParams.set('productId', productId);

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

  return parseMerchEligibilityPayload(payload);
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

export function parseMerchEligibilityPayload(
  payload: EligibilityPayload
): MerchEligibilityResult {
  const sbtBalance = readSbtBalance(payload);
  const minimumSbtBalance = readPositiveNumber(payload.minimumSbtBalance);
  const walletAddress =
    typeof payload.walletAddress === 'string' ? payload.walletAddress : null;

  if (sbtBalance === null) {
    throw new EligibilitySourceError(
      'Eligibility source did not include an SBT balance.'
    );
  }

  if (minimumSbtBalance === null) {
    throw new EligibilitySourceError(
      'Eligibility source did not include an SBT requirement.'
    );
  }

  if (!walletAddress) {
    throw new EligibilitySourceError(
      'Eligibility source did not include a wallet address.'
    );
  }

  const sbtBadgeCount = readOptionalNumber(payload.sbtBadgeCount);
  const status = readEligibilityStatus(
    payload.status,
    sbtBalance,
    sbtBadgeCount,
    minimumSbtBalance
  );
  const reveal = readRevealDetails(payload.reveal);

  if (status === 'eligible' && !reveal) {
    throw new EligibilitySourceError(
      'Eligibility source did not include reveal details.'
    );
  }

  const baseResult = {
    minimumSbtBalance,
    sbtBadgeCount,
    walletAddress,
    sbtBalance
  };

  return status === 'eligible'
    ? { ...baseResult, reveal: reveal as MerchRevealDetails, status }
    : { ...baseResult, status };
}

function readPositiveNumber(value: unknown) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

function readRevealDetails(value: unknown): MerchRevealDetails | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<MerchRevealDetails>;

  if (
    typeof candidate.category !== 'string' ||
    !candidate.category.trim() ||
    typeof candidate.claimName !== 'string' ||
    !candidate.claimName.trim() ||
    typeof candidate.description !== 'string' ||
    !candidate.description.trim() ||
    typeof candidate.hasReverseVideo !== 'boolean' ||
    typeof candidate.requiresSize !== 'boolean' ||
    typeof candidate.statusEyebrow !== 'string' ||
    !candidate.statusEyebrow.trim()
  ) {
    return null;
  }

  return {
    category: candidate.category.trim(),
    claimName: candidate.claimName.trim(),
    description: candidate.description.trim(),
    hasReverseVideo: candidate.hasReverseVideo,
    requiresSize: candidate.requiresSize,
    statusEyebrow: candidate.statusEyebrow.trim()
  };
}

function readEligibilityStatus(
  value: unknown,
  sbtBalance: number,
  sbtBadgeCount: number | undefined,
  minimumSbtBalance: number
) {
  if (typeof value === 'string' && eligibilityStatuses.has(value)) {
    return value as MerchEligibilityResult['status'];
  }

  return (sbtBadgeCount ?? sbtBalance) >= minimumSbtBalance
    ? 'eligible'
    : 'unqualified';
}
