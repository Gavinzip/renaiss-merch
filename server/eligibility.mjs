import { HttpError, sendJson } from './http.mjs';
import { isLocalDemoSession } from './demo-session.mjs';

const DEFAULT_BSCSCAN_API_URL = 'https://api.etherscan.io/v2/api';
const DEFAULT_BSCSCAN_CHAIN_ID = '56';
const DEFAULT_SBT_CONTRACT = '0x7d1b7db704d722295fbaa284008f526634673dbf';
const DEFAULT_CACHE_TTL_SECONDS = 60;
const PAGE_SIZE = 1000;
const PRODUCT_ELIGIBILITY_RULES = {
  shirt: {
    minimumSbtBalance: 60,
    reveal: {
      category: 'Apparel',
      claimName: 'Renaiss Tee',
      description: 'A private Renaiss edition with worldwide fulfilment.',
      hasReverseVideo: true,
      requiresSize: true,
      statusEyebrow: 'RENAISS MERCH'
    }
  },
  bracelet: {
    minimumSbtBalance: 100,
    reveal: {
      category: 'Object',
      claimName: 'RENAISS Bracelet',
      description: 'A private Renaiss object edition with a polished finish.',
      hasReverseVideo: true,
      requiresSize: false,
      statusEyebrow: 'RENAISS OBJECT / DROP 02'
    }
  }
};

const walletPattern = /^0x[a-fA-F0-9]{40}$/;
const eligibilityCache = new Map();

export async function handleMerchEligibility(
  res,
  session,
  requestedProductId,
  options = {}
) {
  const result = await readMerchEligibility(session, {
    productId: requestedProductId
  });

  options.onChecked?.(session, result);
  return sendJson(res, 200, result);
}

export async function readMerchEligibility(session, options = {}) {
  if (!session) {
    throw new HttpError(401, 'unauthenticated');
  }

  const walletAddress = normalizeWallet(session.user.safeWalletAddress);

  if (!walletAddress) {
    throw new HttpError(409, 'safe_wallet_not_ready');
  }

  const productId = readMerchProductId(options.productId);

  if (isLocalDemoSession(session)) {
    return readLocalDemoEligibility(session, productId, walletAddress);
  }

  const config = getEligibilityConfig(productId);
  const balances = await readSbtBalances(walletAddress, config);
  const sbtBalance = sumBalances(balances);
  const sbtBadgeCount = Object.keys(balances).length;

  return applyCurrentMerchEligibilityRule(productId, {
    productId,
    walletAddress,
    sbtBalance,
    sbtBadgeCount,
    minimumSbtBalance: config.minimumSbtBalance,
    sbtContract: config.sbtContract,
    source: 'bscscan_token1155tx'
  });
}

function readLocalDemoEligibility(session, productId, walletAddress) {
  const productRule = PRODUCT_ELIGIBILITY_RULES[productId];
  const minimumSbtBalance = productRule.minimumSbtBalance;
  const configuredDemoBalance = Number(session.user?.demoSbtBalance);
  const verifiedSbtCount =
    Number.isSafeInteger(configuredDemoBalance) && configuredDemoBalance >= 0
      ? configuredDemoBalance
      : Math.max(120, minimumSbtBalance);

  return applyCurrentMerchEligibilityRule(productId, {
    productId,
    walletAddress,
    sbtBalance: verifiedSbtCount,
    sbtBadgeCount: verifiedSbtCount,
    minimumSbtBalance,
    sbtContract: DEFAULT_SBT_CONTRACT,
    source: 'local_demo'
  });
}

export function applyCurrentMerchEligibilityRule(productId, result) {
  const normalizedProductId = readMerchProductId(productId);
  const productRule = PRODUCT_ELIGIBILITY_RULES[normalizedProductId];
  const sbtBalance = Number(result?.sbtBalance);
  const sbtBadgeCount = Number(result?.sbtBadgeCount);
  const verifiedSbtCount = Number.isFinite(sbtBadgeCount)
    ? sbtBadgeCount
    : sbtBalance;
  const status =
    verifiedSbtCount >= productRule.minimumSbtBalance
      ? 'eligible'
      : 'unqualified';
  const normalizedResult = {
    ...result,
    minimumSbtBalance: productRule.minimumSbtBalance,
    productId: normalizedProductId,
    status
  };

  if (status !== 'eligible') {
    const { reveal: _reveal, ...unqualifiedResult } = normalizedResult;
    return unqualifiedResult;
  }

  return {
    ...normalizedResult,
    reveal: { ...productRule.reveal }
  };
}

function getEligibilityConfig(productId) {
  const apiKey = readOptionalEnv('BSCSCAN_API_KEY');

  if (!apiKey) {
    throw new HttpError(500, 'bscscan_not_configured');
  }

  const sbtContract = normalizeWallet(
    readOptionalEnv('ONCHAIN_SBT_CONTRACT') || DEFAULT_SBT_CONTRACT
  );

  if (!sbtContract) {
    throw new HttpError(500, 'sbt_contract_invalid');
  }

  const productRule = PRODUCT_ELIGIBILITY_RULES[productId];

  return {
    apiKey,
    apiUrl: readOptionalEnv('BSCSCAN_API_URL') || DEFAULT_BSCSCAN_API_URL,
    chainId: readOptionalEnv('BSCSCAN_CHAIN_ID') || DEFAULT_BSCSCAN_CHAIN_ID,
    minimumSbtBalance: productRule.minimumSbtBalance,
    sbtCacheTtlMs:
      readPositiveIntegerEnv(
        'MERCH_SBT_CACHE_TTL_SECONDS',
        DEFAULT_CACHE_TTL_SECONDS
      ) * 1000,
    sbtContract
  };
}

export function readMerchProductId(value) {
  const productId =
    typeof value === 'string' && value.trim() ? value.trim() : 'shirt';

  if (!Object.hasOwn(PRODUCT_ELIGIBILITY_RULES, productId)) {
    throw new HttpError(400, 'merch_product_invalid');
  }

  return productId;
}

async function readSbtBalances(walletAddress, config) {
  const cacheKey = `${config.sbtContract}:${walletAddress}`;
  const cached = eligibilityCache.get(cacheKey);

  if (cached && Date.now() - cached.cachedAt <= config.sbtCacheTtlMs) {
    return { ...cached.balances };
  }

  const balances = {};
  let page = 1;

  while (true) {
    const rows = await fetchSbtTransferPage(walletAddress, config, page);

    for (const row of rows) {
      applyTransferRow(balances, walletAddress, row);
    }

    if (rows.length < PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  const positiveBalances = Object.fromEntries(
    Object.entries(balances).filter(([, amount]) => amount > 0)
  );

  eligibilityCache.set(cacheKey, {
    balances: positiveBalances,
    cachedAt: Date.now()
  });

  return { ...positiveBalances };
}

async function fetchSbtTransferPage(walletAddress, config, page) {
  const url = new URL(config.apiUrl);
  url.searchParams.set('chainid', config.chainId);
  url.searchParams.set('module', 'account');
  url.searchParams.set('action', 'token1155tx');
  url.searchParams.set('address', walletAddress);
  url.searchParams.set('contractaddress', config.sbtContract);
  url.searchParams.set('page', String(page));
  url.searchParams.set('offset', String(PAGE_SIZE));
  url.searchParams.set('sort', 'asc');
  url.searchParams.set('apikey', config.apiKey);

  let response;

  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' }
    });
  } catch (error) {
    throw new HttpError(502, 'bscscan_request_failed', String(error));
  }

  if (!response.ok) {
    throw new HttpError(502, 'bscscan_http_error');
  }

  const payload = await response.json();
  const result = payload?.result;

  if (Array.isArray(result)) {
    return result;
  }

  const message = String(payload?.message || '').toLowerCase();
  const resultText = typeof result === 'string' ? result.toLowerCase() : '';

  if (
    payload?.status === '0' &&
    (message.includes('no transactions') || resultText.includes('no transactions'))
  ) {
    return [];
  }

  throw new HttpError(502, 'bscscan_invalid_response');
}

function applyTransferRow(balances, walletAddress, row) {
  const tokenId = String(row?.tokenID ?? row?.tokenId ?? '').trim();

  if (!tokenId) {
    return;
  }

  const amount = Number.parseInt(String(row?.tokenValue ?? '0'), 10);

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return;
  }

  const fromAddress = normalizeWallet(row?.from);
  const toAddress = normalizeWallet(row?.to);

  if (fromAddress === walletAddress) {
    balances[tokenId] = (balances[tokenId] || 0) - amount;
  }

  if (toAddress === walletAddress) {
    balances[tokenId] = (balances[tokenId] || 0) + amount;
  }
}

function sumBalances(balances) {
  return Object.values(balances).reduce((total, amount) => total + amount, 0);
}

function normalizeWallet(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();

  return walletPattern.test(trimmed) ? trimmed.toLowerCase() : '';
}

function readOptionalEnv(name) {
  return process.env[name]?.trim() || '';
}

function readPositiveIntegerEnv(name, fallback) {
  const rawValue = readOptionalEnv(name);
  const value = Number.parseInt(rawValue, 10);

  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
