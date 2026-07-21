import { HttpError } from './http.mjs';

const FULFILLMENT_ADMIN_WALLETS_ENV = 'FULFILLMENT_ADMIN_SAFE_WALLETS';
const walletPattern = /^0x[a-fA-F0-9]{40}$/;

export function canManageFulfillment(session) {
  const walletAddress = normalizeSafeWalletAddress(
    session?.user?.safeWalletAddress
  );

  return walletAddress
    ? readFulfillmentAdminSafeWallets().has(walletAddress)
    : false;
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

function readFulfillmentAdminSafeWallets() {
  const configuredWallets = process.env[FULFILLMENT_ADMIN_WALLETS_ENV]?.trim();

  if (!configuredWallets) {
    return new Set();
  }

  const wallets = new Set();

  for (const value of configuredWallets.split(',')) {
    const walletAddress = normalizeSafeWalletAddress(value);

    if (!walletAddress) {
      throw new HttpError(500, 'fulfillment_admin_wallets_invalid');
    }

    wallets.add(walletAddress);
  }

  return wallets;
}
