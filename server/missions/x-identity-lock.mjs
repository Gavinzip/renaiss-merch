import { createSocialIdentityLock } from './social-identity-lock.mjs';

// A successful X check locks the provider user ID for this campaign. Token
// renewal may reconnect that identity; losing freshness never unlocks it.
export function createXIdentityLock(db) {
  return createSocialIdentityLock(db, 'x');
}
