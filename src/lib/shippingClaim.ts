export type ShippingClaimPayload = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  country: string;
  deliveryNotes: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  postalCode: string;
  region: string;
  size: string;
};

export type ShippingClaimIntent = 'save' | 'submit';

export type ShippingClaimResponse = {
  claimId: string;
  hasSubmitted: boolean;
  savedAt: string;
  status: 'draft' | 'submitted';
  submittedAt: string | null;
};

export type StoredShippingClaimResponse = {
  claim: {
    savedAt: string;
    shipping: Partial<ShippingClaimPayload>;
    status: 'draft' | 'submitted';
    submittedAt: string | null;
  } | null;
  hasSubmitted: boolean;
};

const shippingClaimEndpoint =
  import.meta.env.VITE_MERCH_SHIPPING_CLAIM_ENDPOINT ||
  '/api/merch-shipping-claim';

export async function saveShippingClaim(
  payload: ShippingClaimPayload,
  intent: ShippingClaimIntent
): Promise<ShippingClaimResponse> {
  const response = await fetch(shippingClaimEndpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ intent, shipping: payload })
  });

  if (!response.ok) {
    throw new Error(`Shipping claim endpoint returned ${response.status}.`);
  }

  return (await response.json()) as ShippingClaimResponse;
}

export async function readStoredShippingClaim(): Promise<StoredShippingClaimResponse> {
  const response = await fetch(shippingClaimEndpoint, {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Shipping claim endpoint returned ${response.status}.`);
  }

  return (await response.json()) as StoredShippingClaimResponse;
}
