import data from '../data/bbw.json';
import { communityArchiveAssetUrl } from '../shared/communityArchiveAssets';
import { createBbwWinnerList } from './winnerList';

export const bbwArchive = data;
export const bbwArchiveWinners = createBbwWinnerList(data.rounds);
export const bbwArchiveMedia = {
  venue: communityArchiveAssetUrl('bbw/venue.webp'),
  renaiss: communityArchiveAssetUrl('bbw/renaiss.webp'),
  fourmeme: communityArchiveAssetUrl('bbw/fourmeme.webp'),
  renaissOnLight: communityArchiveAssetUrl('bbw/renaiss-transparent.webp'),
  fourmemeOnLight: communityArchiveAssetUrl('bbw/fourmeme-dark.svg'),
};
