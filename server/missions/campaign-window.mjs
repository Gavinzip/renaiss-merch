import { surfCampaign } from '../../shared/surf-campaign.js';
import { HttpError } from '../http.mjs';
export function surfCampaignClosed(campaign = surfCampaign.id, now = Date.now()) {
  return campaign === surfCampaign.id && now >= Date.parse(surfCampaign.endsAt);
}
export function assertSurfCampaignOpen(campaign = surfCampaign.id) {
  if (surfCampaignClosed(campaign)) throw new HttpError(409, 'surf_campaign_closed');
}
