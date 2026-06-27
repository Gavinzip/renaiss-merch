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
};

export type ShippingClaimResponse = {
  claimId: string;
  status: 'saved';
};

const shippingClaimEndpoint =
  import.meta.env.VITE_MERCH_SHIPPING_CLAIM_ENDPOINT ||
  '/api/merch-shipping-claim';

export async function saveShippingClaim(
  payload: ShippingClaimPayload
): Promise<ShippingClaimResponse> {
  const response = await fetch(shippingClaimEndpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Shipping claim endpoint returned ${response.status}.`);
  }

  return (await response.json()) as ShippingClaimResponse;
}
