import type { ShippingClaimPayload } from './shippingClaim';

export type ShippingProfilePayload = Omit<
  ShippingClaimPayload,
  'color' | 'size'
>;

export type StoredShippingProfileResponse = {
  profile: ShippingProfilePayload | null;
  savedAt: string | null;
};

export class ShippingProfileError extends Error {
  code: string;
  status: number;

  constructor(status: number, code: string) {
    super(`Shipping profile endpoint returned ${status}: ${code}.`);
    this.name = 'ShippingProfileError';
    this.code = code;
    this.status = status;
  }
}

const shippingProfileEndpoint =
  import.meta.env.VITE_MERCH_SHIPPING_PROFILE_ENDPOINT ||
  '/api/merch-shipping-profile';

export async function readStoredShippingProfile(): Promise<StoredShippingProfileResponse> {
  const response = await fetch(shippingProfileEndpoint, {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new ShippingProfileError(
      response.status,
      await readErrorCode(response)
    );
  }

  return (await response.json()) as StoredShippingProfileResponse;
}

export async function saveShippingProfile(
  profile: ShippingProfilePayload
): Promise<StoredShippingProfileResponse> {
  const response = await fetch(shippingProfileEndpoint, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ profile })
  });

  if (!response.ok) {
    throw new ShippingProfileError(
      response.status,
      await readErrorCode(response)
    );
  }

  return (await response.json()) as StoredShippingProfileResponse;
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
