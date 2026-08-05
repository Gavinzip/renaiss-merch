import { readMerchProductId } from './eligibility.mjs';
import { HttpError } from './http.mjs';
import { getMerchMediaAsset } from './merch-media-assets.mjs';
import { readMerchProductAccess } from './merch-product-access.mjs';
import { deliverProtectedMedia } from './protected-media.mjs';

export async function handleMerchRevealThumbnail(
  req,
  res,
  session,
  requestedProductId,
  requestedVariant,
  options = {}
) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    throw new HttpError(405, 'method_not_allowed');
  }

  const productId = readMerchProductId(requestedProductId);
  const access = await readMerchProductAccess(session, {
    ...options,
    productId
  });

  if (access.status !== 'eligible') {
    throw new HttpError(403, 'merch_reveal_forbidden');
  }

  const assetKey = readProductImageAsset(
    productId,
    requestedVariant
  );
  await deliverProtectedMedia(req, res, getMerchMediaAsset(assetKey), {
    requestFailedCode: 'merch_reveal_thumbnail_request_failed',
    unavailableCode: 'merch_reveal_thumbnail_unavailable'
  });
}

function readProductImageAsset(productId, requestedVariant) {
  if (productId !== 'bracelet') {
    return 'shirtProduct';
  }

  if (requestedVariant === 'silver') {
    return 'braceletProductSilver';
  }

  if (requestedVariant === 'store-cover') {
    return 'braceletStoreCover';
  }

  return 'braceletProductGold';
}
