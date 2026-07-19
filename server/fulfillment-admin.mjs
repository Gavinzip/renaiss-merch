import { HttpError } from './http.mjs';

const walletPattern = /^0x[a-fA-F0-9]{40}$/;

export const FULFILLMENT_ADMIN_SAFE_WALLETS = new Set([
  '0xf77fb7a401a04ca0d89d12603840a2e9fe3c834f',
  '0x14f84ff15797fadb27a866c5f5afd831f3b43d8'
]);

export function canManageFulfillment(session) {
  const walletAddress = normalizeSafeWalletAddress(
    session?.user?.safeWalletAddress
  );

  return walletAddress ? FULFILLMENT_ADMIN_SAFE_WALLETS.has(walletAddress) : false;
}

export function requireFulfillmentAdministrator(session) {
  if (!session) {
    throw new HttpError(401, 'unauthenticated');
  }

  if (!canManageFulfillment(session)) {
    throw new HttpError(403, 'fulfillment_access_denied');
  }
}

function normalizeSafeWalletAddress(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const walletAddress = value.trim().toLowerCase();

  return walletPattern.test(walletAddress) ? walletAddress : null;
}
