import { HttpError, sendJson } from './http.mjs';
import {
  getMerchDatabase,
  runWithSqliteBusyRetry
} from './merch-database.mjs';
import {
  normalizeShippingProfilePayload,
  readJsonBody
} from './shipping-details.mjs';

export function handleStoredMerchShippingProfile(res, session, options = {}) {
  requireSessionIdentity(session);

  sendJson(res, 200, readShippingProfile(session, options));
}

export async function handleMerchShippingProfile(
  req,
  res,
  session,
  options = {}
) {
  const userSub = requireSessionIdentity(session);
  const payload = await readJsonBody(req);
  const profile = normalizeShippingProfilePayload(payload.profile || payload);
  const savedProfile = saveShippingProfile(
    {
      profile,
      userSub,
      walletAddress: readOptionalWalletAddress(
        session.user.safeWalletAddress
      )
    },
    options
  );

  sendJson(res, 200, savedProfile);
}

export function readShippingProfile(session, options = {}) {
  const userSub = requireSessionIdentity(session);
  const database = getMerchDatabase(options.dbPath);
  const row = database
    .prepare(
      `
        SELECT profile_json, updated_at
        FROM shipping_profiles
        WHERE user_sub = ?
        LIMIT 1
      `
    )
    .get(userSub);

  return {
    profile: row ? JSON.parse(row.profile_json) : null,
    savedAt: row?.updated_at || null
  };
}

export function saveShippingProfile(input, options = {}) {
  const database = getMerchDatabase(options.dbPath);
  const savedAt = new Date().toISOString();

  runWithSqliteBusyRetry(() => {
    database
      .prepare(
        `
          INSERT INTO shipping_profiles (
            user_sub,
            wallet_address,
            profile_json,
            created_at,
            updated_at
          ) VALUES (
            @userSub,
            @walletAddress,
            @profileJson,
            @savedAt,
            @savedAt
          )
          ON CONFLICT(user_sub) DO UPDATE SET
            wallet_address = excluded.wallet_address,
            profile_json = excluded.profile_json,
            updated_at = excluded.updated_at
        `
      )
      .run({
        profileJson: JSON.stringify(input.profile),
        savedAt,
        userSub: input.userSub,
        walletAddress: input.walletAddress
      });
  });

  return {
    profile: input.profile,
    savedAt
  };
}

function requireSessionIdentity(session) {
  if (!session) {
    throw new HttpError(401, 'unauthenticated');
  }

  const userSub =
    typeof session.user?.sub === 'string' ? session.user.sub.trim() : '';

  if (!userSub) {
    throw new HttpError(409, 'identity_not_ready');
  }

  return userSub;
}

function readOptionalWalletAddress(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim().toLowerCase()
    : null;
}
