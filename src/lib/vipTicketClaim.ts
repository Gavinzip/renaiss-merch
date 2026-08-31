import type { MerchProductId } from './merchProducts';

export type VipTicketClaim = {
  email: string;
  productId: MerchProductId;
  savedAt: string;
  status: 'submitted';
  submittedAt: string;
};

export type VipTicketClaimResponse = {
  claim: VipTicketClaim | null;
  hasSubmitted: boolean;
};

export class VipTicketClaimError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(`VIP ticket claim returned ${status}: ${code}.`);
    this.name = 'VipTicketClaimError';
  }
}

const endpoint = '/api/merch-vip-ticket-claim';

export async function readStoredVipTicketClaim() {
  const url = new URL(endpoint, window.location.origin);
  url.searchParams.set('productId', 'ticket');
  const response = await fetch(url, {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new VipTicketClaimError(response.status, await readErrorCode(response));
  }

  return (await response.json()) as VipTicketClaimResponse;
}

export async function submitVipTicketClaim(email: string) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, productId: 'ticket' })
  });

  if (!response.ok) {
    throw new VipTicketClaimError(response.status, await readErrorCode(response));
  }

  return (await response.json()) as VipTicketClaimResponse;
}

async function readErrorCode(response: Response) {
  try {
    const body = (await response.json()) as { code?: unknown };
    return typeof body.code === 'string' && body.code
      ? body.code
      : 'request_failed';
  } catch {
    return 'request_failed';
  }
}
