import { createHmac } from 'node:crypto';
import { surfCampaign } from '../../shared/surf-campaign.js';
import { HttpError } from '../http.mjs';
import { missionEncryptionKey } from './config.mjs';
import { surfAccountConfig } from './surf-config.mjs';
import { createSurfRateStore } from './surf-rate-store.mjs';
import { normalizeSurfEmail, verifySurfRegistration } from './providers/surf-registration.mjs';

function verifiedEmail(user) {
  if (typeof user?.email !== 'string' || !user.email.trim()) throw new HttpError(409, 'renaiss_email_missing');
  if (user.emailVerified !== true) throw new HttpError(409, user.emailVerificationStatus === 'unverified' ?
    'renaiss_email_unverified' : 'renaiss_email_verification_unavailable');
  try { return normalizeSurfEmail(user.email); }
  catch { throw new HttpError(409, 'renaiss_email_invalid'); }
}
function emailHash(email) {
  return createHmac('sha256', missionEncryptionKey()).update(JSON.stringify([surfCampaign.id, email])).digest('hex');
}

function resultBinding(config, email) {
  // A result from the retired email-code flow is not an SSO-email result.
  return createHmac('sha256', config.partnerKey).update(JSON.stringify(['renaiss-verified-email-v1', emailHash(email)])).digest('hex');
}

export function readAccountsState(user, { storeFactory }) {
  let config, configurationReason;
  try { config = surfAccountConfig(); }
  catch (error) { configurationReason = error.code; }
  const configuration = { configured: Boolean(config) };
  if (!user?.sub || user.isDemo) return { ...configuration, outcome: 'pending', reason: user?.isDemo ? 'demo_missions_disabled' : 'unauthenticated' };
  let email;
  try { email = verifiedEmail(user); }
  catch (error) { return { ...configuration, ownershipVerified: false, outcome: 'pending', reason: error.code }; }
  const ownership = { ...configuration, ownershipVerified: true, email };
  if (!config) return { ...ownership, outcome: 'unavailable', reason: configurationReason };
  const result = storeFactory().getResult(surfCampaign.id, user.sub, 'accounts');
  // Results cannot survive a changed verified email or partner credential.
  const binding = resultBinding(config, email);
  if (!result || result.binding !== binding) return { ...ownership, outcome: 'pending' };
  const { binding: _binding, ...safeResult } = result;
  return { ...ownership, ...safeResult };
}

export async function checkAccounts(user, { store, fetchImpl = fetch, rateStore = createSurfRateStore(), assertCurrentUser = () => user }) {
  const email = verifiedEmail(user), config = surfAccountConfig(), hash = emailHash(email);
  const assertEmailIdentity = () => {
    const current = assertCurrentUser();
    if (current?.sub !== user.sub || current.isDemo) throw new HttpError(401, 'unauthenticated');
    if (verifiedEmail(current) !== email) throw new HttpError(409, 'renaiss_email_changed');
  };
  assertEmailIdentity();
  const release = store.acquire(surfCampaign.id, user.sub, 'accounts');
  try {
    store.assertAccountAvailable(surfCampaign.id, user.sub, hash);
    const retryAfterSeconds = rateStore.reserve(config.partnerKey);
    let result = retryAfterSeconds === null
      ? await verifySurfRegistration({ email, partnerKey: config.partnerKey, fetchImpl })
      : { outcome: 'unavailable', reason: 'surf_rate_limited', retryAfterSeconds };
    if (result.reason === 'surf_rate_limited' && result.retryAfterSeconds)
      rateStore.defer(config.partnerKey, result.retryAfterSeconds);
    assertEmailIdentity();
    result = { ...result, checkedAt: new Date().toISOString(),
      binding: resultBinding(config, email) };
    if (result.outcome === 'verified') store.bindAccount(surfCampaign.id, user.sub, hash);
    // Invalid upstream responses replace an old pass, but never masquerade as
    // evidence that the Surf account does not exist.
    store.saveResult(surfCampaign.id, user.sub, 'accounts', result);
  } finally { release(); }
}

export function missionEntries(accounts, providers) {
  if (accounts.outcome === 'incomplete') return 0;
  if (accounts.outcome !== 'verified' || accounts.stale) return null;
  return 1 + Object.values(providers).filter(task => task.configured && task.connection &&
    task.result?.outcome === 'verified' && !task.result.stale).length;
}
