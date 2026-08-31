import { readMerchProductId } from './eligibility.mjs';
import { HttpError } from './http.mjs';
import { getMerchMediaAsset } from './merch-media-assets.mjs';
import { readMerchProductAccess } from './merch-product-access.mjs';
import { deliverProtectedMedia } from './protected-media.mjs';

export async function handleMerchRevealVideo(
  req,
  res,
  session,
  requestedProductId,
  options = {}
) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    throw new HttpError(405, 'method_not_allowed');
  }

  const productId = readMerchProductId(requestedProductId);

  if (productId !== 'ticket') {
    throw new HttpError(400, 'merch_private_reveal_product_invalid');
  }

  const access = await readMerchProductAccess(session, {
    ...options,
    productId
  });

  if (access.status !== 'eligible') {
    throw new HttpError(403, 'merch_reveal_forbidden');
  }

  await deliverProtectedMedia(
    req,
    res,
    getMerchMediaAsset('ticketRevealForward'),
    {
      acceptRanges: true,
      requestFailedCode: 'merch_reveal_video_request_failed',
      unavailableCode: 'merch_reveal_video_unavailable'
    }
  );
}
