import type { MerchProductId } from './merchProducts';

export type ShippingClaimPayload = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  color: string;
  country: string;
  deliveryMethod: ShippingDeliveryMethod;
  deliveryNotes: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  postalCode: string;
  region: string;
  sevenElevenSelectionToken: string;
  sevenElevenStoreAddress: string;
  sevenElevenStoreId: string;
  sevenElevenStoreName: string;
  sevenElevenStoreOutside: string;
  size: string;
};

export type ShippingDeliveryMethod =
  | 'home_delivery'
  | 'seven_eleven_c2c';

export type ShippingClaimIntent = 'save' | 'submit';

export type ShippingClaimResponse = {
  claimId: string;
  hasSubmitted: boolean;
  productId: MerchProductId;
  savedAt: string;
  status: 'draft' | 'submitted';
  submittedAt: string | null;
};

export type StoredShippingClaimResponse = {
  claim: {
    productId: MerchProductId;
    savedAt: string;
    shipping: Partial<ShippingClaimPayload>;
    status: 'draft' | 'submitted';
    submittedAt: string | null;
  } | null;
  hasSubmitted: boolean;
};

export class ShippingClaimError extends Error {
  code: string;
  status: number;

  constructor(status: number, code: string) {
    super(`Shipping claim endpoint returned ${status}: ${code}.`);
    this.name = 'ShippingClaimError';
    this.code = code;
    this.status = status;
  }
}

const shippingClaimEndpoint =
  import.meta.env.VITE_MERCH_SHIPPING_CLAIM_ENDPOINT ||
  '/api/merch-shipping-claim';

export async function saveShippingClaim(
  payload: ShippingClaimPayload,
  intent: ShippingClaimIntent,
  productId: MerchProductId = 'shirt'
): Promise<ShippingClaimResponse> {
  const response = await fetch(shippingClaimEndpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ intent, productId, shipping: payload })
  });

  if (!response.ok) {
    throw new ShippingClaimError(response.status, await readErrorCode(response));
  }

  return (await response.json()) as ShippingClaimResponse;
}

export async function readStoredShippingClaim(
  productId: MerchProductId = 'shirt'
): Promise<StoredShippingClaimResponse> {
  const endpoint = new URL(shippingClaimEndpoint, window.location.origin);
  endpoint.searchParams.set('productId', productId);
  const response = await fetch(endpoint, {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new ShippingClaimError(response.status, await readErrorCode(response));
  }

  return (await response.json()) as StoredShippingClaimResponse;
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
