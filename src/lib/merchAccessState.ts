import {
  parseMerchEligibilityPayload,
  type EligibilityPayload,
  type MerchEligibilityResult
} from './merchEligibility';
import {
  isMerchProductId,
  type MerchProductId
} from './merchProducts';

export type MerchClaimStatus = 'draft' | 'submitted' | null;

export type MerchAccessProductState = MerchEligibilityResult & {
  checkedAt: string;
  claimStatus: MerchClaimStatus;
  productId: MerchProductId;
};

type MerchAccessStatePayload = {
  products?: unknown;
};

export async function readMerchAccessState(): Promise<
  readonly MerchAccessProductState[]
> {
  const response = await fetch('/api/merch-access-state', {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Merch access state returned ${response.status}.`);
  }

  const payload = (await response.json()) as MerchAccessStatePayload;

  if (!Array.isArray(payload.products)) {
    throw new Error('Merch access state did not include products.');
  }

  return payload.products.map(readMerchAccessProductState);
}

export function createMerchAccessProductState(
  productId: MerchProductId,
  result: MerchEligibilityResult,
  claimStatus: MerchClaimStatus = null
): MerchAccessProductState {
  return {
    ...result,
    checkedAt: new Date().toISOString(),
    claimStatus,
    productId
  };
}

function readMerchAccessProductState(
  value: unknown
): MerchAccessProductState {
  if (!value || typeof value !== 'object') {
    throw new Error('Merch access product state is invalid.');
  }

  const candidate = value as EligibilityPayload & {
    checkedAt?: unknown;
    claimStatus?: unknown;
    productId?: unknown;
  };

  if (!isMerchProductId(candidate.productId)) {
    throw new Error('Merch access product id is invalid.');
  }

  if (
    typeof candidate.checkedAt !== 'string' ||
    !candidate.checkedAt.trim()
  ) {
    throw new Error('Merch access check time is invalid.');
  }

  return {
    ...parseMerchEligibilityPayload(candidate),
    checkedAt: candidate.checkedAt,
    claimStatus: readClaimStatus(candidate.claimStatus),
    productId: candidate.productId
  };
}

function readClaimStatus(value: unknown): MerchClaimStatus {
  if (value === 'draft' || value === 'submitted') {
    return value;
  }

  return null;
}
