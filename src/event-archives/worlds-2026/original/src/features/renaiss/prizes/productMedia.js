import { communityArchiveAssetUrl } from '../../../../../../shared/communityArchiveAssets';
const media = { 'origins-tc': 'origins-tc.jpg', 'unleashed-cn': 'unleashed-cn.webp', 'origins-en': 'origins-en.webp' };
export function getProductMedia(id) { if (!media[id])
    throw new Error('Unknown archived prize'); return { modelImage: communityArchiveAssetUrl('worlds-2026/' + media[id]) }; }
