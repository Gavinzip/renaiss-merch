import { randomBytes } from 'node:crypto';
import { readMerchProductId } from './eligibility.mjs';
import { HttpError, redirect, sendJson } from './http.mjs';
import {
  getMerchDatabase,
  runWithSqliteBusyRetry
} from './merch-database.mjs';
import { readJsonBody } from './shipping-details.mjs';

const ECPAY_STAGE_MAP_URL =
  'https://logistics-stage.ecpay.com.tw/Express/map';
const ECPAY_PRODUCTION_MAP_URL =
  'https://logistics.ecpay.com.tw/Express/map';
const LOGISTICS_SUB_TYPE = 'UNIMARTC2C';
const PENDING_SELECTION_MINUTES = 30;
const MAX_FORM_BODY_BYTES = 16 * 1024;
const tokenPattern = /^[A-Za-z0-9]{20}$/;
const merchantIdPattern = /^[A-Za-z0-9]{1,10}$/;
const storeIdPattern = /^\d{6}$/;
const hanCharacterPattern = /\p{Script=Han}/u;

export function requireSevenElevenStoreMapConfiguration() {
  return readEcpayStoreMapEnvironment();
}

export async function handleSevenElevenMapStart(
  req,
  res,
  session,
  options = {}
) {
  const userSub = requireSessionIdentity(session);
  const payload = await readUrlEncodedBody(req);
  const context = readSelectionContext(payload.get('context'));
  const productId =
    context === 'claim'
      ? readMerchProductId(payload.get('productId'))
      : null;
  const returnTo = readSafeReturnTo(payload.get('returnTo'));
  const device = payload.get('device') === '1' ? '1' : '0';
  const config = getEcpayStoreMapConfig(options.publicOrigin);
  const selection = createPendingSelection(
    {
      context,
      merchantId: config.merchantId,
      productId,
      returnTo,
      userSub
    },
    options
  );

  sendMapRedirectPage(res, config.endpoint, {
    Device: device,
    IsCollection: 'N',
    LogisticsSubType: LOGISTICS_SUB_TYPE,
    LogisticsType: 'CVS',
    MerchantID: config.merchantId,
    MerchantTradeNo: selection.token,
    ServerReplyURL: `${config.publicOrigin}/api/merch-7-eleven/callback`
  });
}

export async function handleSevenElevenMapCallback(req, res, options = {}) {
  const payload = await readUrlEncodedBody(req);
  const token = readSelectionToken(payload.get('MerchantTradeNo'));
  const selection = readSelectionByToken(token, options);

  if (!selection || new Date(selection.expires_at).getTime() <= Date.now()) {
    throw new HttpError(410, 'seven_eleven_selection_expired');
  }

  const merchantId = readMerchantId(payload.get('MerchantID'));
  const logisticsSubType = readRequiredText(
    payload.get('LogisticsSubType'),
    'seven_eleven_logistics_sub_type_invalid',
    20
  );

  if (
    merchantId !== selection.merchant_id ||
    logisticsSubType !== LOGISTICS_SUB_TYPE
  ) {
    throw new HttpError(400, 'seven_eleven_callback_invalid');
  }

  const store = {
    address: readChineseStoreText(
      payload.get('CVSAddress'),
      'seven_eleven_store_address_invalid',
      60
    ),
    id: readStoreId(payload.get('CVSStoreID')),
    name: readChineseStoreText(
      payload.get('CVSStoreName'),
      'seven_eleven_store_name_invalid',
      10
    ),
    outside: readStoreOutside(payload.get('CVSOutSide'))
  };

  saveReturnedSelection(selection, store, options);
  redirect(res, buildSelectionReturnLocation(selection, token), 303);
}

export async function handleSevenElevenSelectionConsume(
  req,
  res,
  session,
  options = {}
) {
  const userSub = requireSessionIdentity(session);
  const payload = await readJsonBody(req);
  const token = readSelectionToken(payload?.token);
  const selection = readSelectedStore(token, userSub, options);

  markSelectionConsumed(token, userSub, options);
  sendJson(res, 200, toPublicSelection(selection));
}

export function resolveSevenElevenShippingDetails(
  session,
  shipping,
  options = {}
) {
  if (shipping.deliveryMethod !== 'seven_eleven_c2c') {
    return shipping;
  }

  const userSub = requireSessionIdentity(session);
  const selection = readSelectedStore(
    shipping.sevenElevenSelectionToken,
    userSub,
    options
  );

  return {
    ...shipping,
    sevenElevenSelectionToken: selection.token,
    sevenElevenStoreAddress: selection.store_address,
    sevenElevenStoreId: selection.store_id,
    sevenElevenStoreName: selection.store_name,
    sevenElevenStoreOutside: selection.store_outside
  };
}

function getEcpayStoreMapConfig(publicOrigin) {
  const environment = readEcpayStoreMapEnvironment();

  if (typeof publicOrigin !== 'string' || !publicOrigin) {
    throw new HttpError(500, 'public_origin_unavailable');
  }

  if (
    environment.mode === 'production' &&
    !publicOrigin.startsWith('https://')
  ) {
    throw new HttpError(500, 'ecpay_callback_https_required');
  }

  return {
    endpoint:
      environment.mode === 'production'
        ? ECPAY_PRODUCTION_MAP_URL
        : ECPAY_STAGE_MAP_URL,
    merchantId: environment.merchantId,
    publicOrigin
  };
}

function readEcpayStoreMapEnvironment() {
  const mode = process.env.ECPAY_LOGISTICS_MODE?.trim();
  const merchantId = process.env.ECPAY_LOGISTICS_MERCHANT_ID?.trim();

  if (mode !== 'stage' && mode !== 'production') {
    throw new HttpError(503, 'ecpay_logistics_mode_not_configured');
  }

  if (!merchantId || !merchantIdPattern.test(merchantId)) {
    throw new HttpError(503, 'ecpay_logistics_merchant_id_not_configured');
  }

  return { merchantId, mode };
}

function createPendingSelection(input, options) {
  const database = getSelectionDatabase(options);
  const createdAt = new Date();
  const expiresAt = new Date(
    createdAt.getTime() + PENDING_SELECTION_MINUTES * 60 * 1000
  );

  cleanupExpiredPendingSelections(database);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const selection = {
      ...input,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      token: randomBytes(10).toString('hex')
    };

    try {
      runWithSqliteBusyRetry(() => {
        database
          .prepare(
            `
              INSERT INTO seven_eleven_store_selections (
                token,
                user_sub,
                context,
                product_id,
                return_to,
                merchant_id,
                created_at,
                expires_at
              ) VALUES (
                @token,
                @userSub,
                @context,
                @productId,
                @returnTo,
                @merchantId,
                @createdAt,
                @expiresAt
              )
            `
          )
          .run(selection);
      });

      return selection;
    } catch (error) {
      if (error?.code !== 'SQLITE_CONSTRAINT_PRIMARYKEY') {
        throw error;
      }
    }
  }

  throw new HttpError(500, 'seven_eleven_selection_create_failed');
}

function saveReturnedSelection(selection, store, options) {
  const database = getSelectionDatabase(options);
  const selectedAt = new Date().toISOString();

  if (selection.selected_at) {
    const matchesExistingSelection =
      selection.logistics_sub_type === LOGISTICS_SUB_TYPE &&
      selection.store_id === store.id &&
      selection.store_name === store.name &&
      selection.store_address === store.address &&
      selection.store_outside === store.outside;

    if (!matchesExistingSelection) {
      throw new HttpError(409, 'seven_eleven_selection_already_returned');
    }

    return;
  }

  runWithSqliteBusyRetry(() => {
    const result = database
      .prepare(
        `
          UPDATE seven_eleven_store_selections
          SET
            logistics_sub_type = @logisticsSubType,
            store_id = @storeId,
            store_name = @storeName,
            store_address = @storeAddress,
            store_outside = @storeOutside,
            selected_at = @selectedAt
          WHERE token = @token
            AND selected_at IS NULL
        `
      )
      .run({
        logisticsSubType: LOGISTICS_SUB_TYPE,
        selectedAt,
        storeAddress: store.address,
        storeId: store.id,
        storeName: store.name,
        storeOutside: store.outside,
        token: selection.token
      });

    if (result.changes !== 1) {
      throw new HttpError(409, 'seven_eleven_selection_already_returned');
    }
  });
}

function readSelectedStore(token, userSub, options) {
  const selection = readSelectionByToken(readSelectionToken(token), options);

  if (!selection || selection.user_sub !== userSub) {
    throw new HttpError(404, 'seven_eleven_selection_not_found');
  }

  if (
    !selection.selected_at ||
    selection.logistics_sub_type !== LOGISTICS_SUB_TYPE ||
    !selection.store_id ||
    !selection.store_name ||
    !selection.store_address
  ) {
    throw new HttpError(409, 'seven_eleven_selection_not_ready');
  }

  return selection;
}

function readSelectionByToken(token, options) {
  return getSelectionDatabase(options)
    .prepare(
      `
        SELECT *
        FROM seven_eleven_store_selections
        WHERE token = ?
        LIMIT 1
      `
    )
    .get(token);
}

function markSelectionConsumed(token, userSub, options) {
  runWithSqliteBusyRetry(() => {
    getSelectionDatabase(options)
      .prepare(
        `
          UPDATE seven_eleven_store_selections
          SET consumed_at = COALESCE(consumed_at, @consumedAt)
          WHERE token = @token
            AND user_sub = @userSub
            AND selected_at IS NOT NULL
        `
      )
      .run({
        consumedAt: new Date().toISOString(),
        token,
        userSub
      });
  });
}

function cleanupExpiredPendingSelections(database) {
  runWithSqliteBusyRetry(() => {
    database
      .prepare(
        `
          DELETE FROM seven_eleven_store_selections
          WHERE selected_at IS NULL
            AND expires_at <= ?
        `
      )
      .run(new Date().toISOString());
  });
}

function getSelectionDatabase(options) {
  return getMerchDatabase(options.selectionDbPath || options.dbPath);
}

function buildSelectionReturnLocation(selection, token) {
  const location = new URL(selection.return_to, 'http://renaiss.local');

  location.searchParams.set('sevenElevenSelection', token);
  location.searchParams.set('sevenElevenContext', selection.context);

  if (selection.product_id) {
    location.searchParams.set('sevenElevenProduct', selection.product_id);
  }

  return `${location.pathname}${location.search}${location.hash}`;
}

function toPublicSelection(selection) {
  return {
    context: selection.context,
    productId: selection.product_id,
    selectionToken: selection.token,
    store: {
      address: selection.store_address,
      id: selection.store_id,
      name: selection.store_name,
      outside: selection.store_outside === '1'
    }
  };
}

function readSelectionContext(value) {
  if (value !== 'profile' && value !== 'claim') {
    throw new HttpError(400, 'seven_eleven_selection_context_invalid');
  }

  return value;
}

function readSafeReturnTo(value) {
  const returnTo =
    typeof value === 'string' && value.trim() ? value.trim() : '/#store';

  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) {
    throw new HttpError(400, 'seven_eleven_return_to_invalid');
  }

  const parsed = new URL(returnTo, 'http://renaiss.local');

  if (
    parsed.origin !== 'http://renaiss.local' ||
    (!isStorefrontPath(parsed.pathname))
  ) {
    throw new HttpError(400, 'seven_eleven_return_to_invalid');
  }

  parsed.searchParams.delete('sevenElevenSelection');
  parsed.searchParams.delete('sevenElevenContext');
  parsed.searchParams.delete('sevenElevenProduct');
  return `${parsed.pathname}${parsed.search}${parsed.hash || '#store'}`;
}

function isStorefrontPath(pathname) {
  return (
    pathname === '/' ||
    pathname === '/v1.2' ||
    pathname === '/v1.2/'
  );
}

function readSelectionToken(value) {
  const token = typeof value === 'string' ? value.trim() : '';

  if (!tokenPattern.test(token)) {
    throw new HttpError(400, 'seven_eleven_selection_token_invalid');
  }

  return token;
}

function readMerchantId(value) {
  const merchantId = typeof value === 'string' ? value.trim() : '';

  if (!merchantIdPattern.test(merchantId)) {
    throw new HttpError(400, 'seven_eleven_merchant_id_invalid');
  }

  return merchantId;
}

function readStoreId(value) {
  const storeId = typeof value === 'string' ? value.trim() : '';

  if (!storeIdPattern.test(storeId)) {
    throw new HttpError(400, 'seven_eleven_store_id_invalid');
  }

  return storeId;
}

function readStoreOutside(value) {
  if (value === undefined || value === null || value === '') {
    return '0';
  }

  if (value !== '0' && value !== '1') {
    throw new HttpError(400, 'seven_eleven_store_outside_invalid');
  }

  return value;
}

function readRequiredText(value, code, maxLength) {
  const text =
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

  if (!text || text.length > maxLength) {
    throw new HttpError(400, code);
  }

  return text;
}

function readChineseStoreText(value, code, maxLength) {
  const text = readRequiredText(value, code, maxLength);

  if (!hanCharacterPattern.test(text)) {
    throw new HttpError(400, code);
  }

  return text;
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

async function readUrlEncodedBody(req) {
  const contentType = String(req.headers['content-type'] || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();

  if (contentType !== 'application/x-www-form-urlencoded') {
    throw new HttpError(415, 'form_content_type_required');
  }

  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;

    if (size > MAX_FORM_BODY_BYTES) {
      throw new HttpError(413, 'request_too_large');
    }

    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    throw new HttpError(400, 'request_body_required');
  }

  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

function sendMapRedirectPage(res, endpoint, fields) {
  const nonce = randomBytes(18).toString('base64url');
  const inputs = Object.entries(fields)
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`
    )
    .join('');
  const body = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>前往 7-ELEVEN 選擇門市</title></head><body><form id="ecpay-map" action="${escapeHtml(endpoint)}" method="post">${inputs}<button type="submit">前往 7-ELEVEN 選擇門市</button></form><script nonce="${nonce}">document.getElementById('ecpay-map').submit();</script></body></html>`;

  res.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    'Content-Security-Policy': `default-src 'none'; form-action ${endpoint}; script-src 'nonce-${nonce}'; style-src 'none'; base-uri 'none'; frame-ancestors 'none'`,
    'Content-Type': 'text/html; charset=utf-8',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
