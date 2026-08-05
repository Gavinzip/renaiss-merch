import { HttpError } from './http.mjs';
import { readMerchProductId } from './eligibility.mjs';
import { getMerchMediaAsset } from './merch-media-assets.mjs';
import { readMerchProductAccess } from './merch-product-access.mjs';
import { deliverProtectedMedia } from './protected-media.mjs';

export async function handleMerchRevealMedia(
  req,
  res,
  session,
  requestedProductId,
  requestedDirection,
  options = {}
) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    throw new HttpError(405, 'method_not_allowed');
  }

  const productId = readMerchProductId(requestedProductId);
  const direction = readDirection(requestedDirection);
  const access = await readMerchProductAccess(session, {
    ...options,
    productId
  });

  if (access.status !== 'eligible') {
    throw new HttpError(403, 'merch_reveal_forbidden');
  }

  const assetKey =
    productId === 'bracelet'
      ? direction === 'forward'
        ? 'braceletRevealForward'
        : 'braceletRevealReverse'
      : direction === 'forward'
        ? 'shirtRevealForward'
        : 'shirtRevealReverse';

  await deliverProtectedMedia(req, res, getMerchMediaAsset(assetKey), {
    acceptRanges: true,
    requestFailedCode: 'merch_reveal_media_request_failed',
    unavailableCode: 'merch_reveal_media_unavailable'
  });
}

function readDirection(value) {
  const direction =
    typeof value === 'string' && value.trim() ? value.trim() : 'forward';

  if (direction !== 'forward' && direction !== 'reverse') {
    throw new HttpError(400, 'merch_reveal_direction_invalid');
  }

  return direction;
}
