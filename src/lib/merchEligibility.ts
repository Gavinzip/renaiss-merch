export const MINIMUM_MERCH_SBT_BALANCE = 40;

export type MerchEligibilityResult = {
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

type EligibilityPayload = {
  sbtBalance?: unknown;
  sbtCount?: unknown;
  sbt?: unknown;
  sbt_balance?: unknown;
};

function readSbtBalance(payload: EligibilityPayload) {
  const rawBalance =
    payload.sbtBalance ?? payload.sbtCount ?? payload.sbt ?? payload.sbt_balance;
  const balance = Number(rawBalance);

  return Number.isFinite(balance) ? balance : null;
}

export async function checkMerchEligibility(
  walletAddress: string
): Promise<MerchEligibilityResult> {
  const endpoint =
    import.meta.env.VITE_MERCH_ELIGIBILITY_ENDPOINT || '/api/merch-eligibility';
  const url = new URL(endpoint, window.location.origin);
  url.searchParams.set('wallet', walletAddress);

  const response = await fetch(url, {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new EligibilitySourceError(
      `Eligibility source returned ${response.status}.`
    );
  }

  const payload = (await response.json()) as EligibilityPayload;
  const sbtBalance = readSbtBalance(payload);

  if (sbtBalance === null) {
    throw new EligibilitySourceError(
      'Eligibility source did not include an SBT balance.'
    );
  }

  return {
    walletAddress,
    sbtBalance,
    status:
      sbtBalance >= MINIMUM_MERCH_SBT_BALANCE ? 'eligible' : 'unqualified'
  };
}
