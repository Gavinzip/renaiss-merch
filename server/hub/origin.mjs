import { HttpError } from "../http.mjs";

export function communityHubOrigin() {
  try {
    const url = new URL(process.env.COMMUNITY_HUB_ORIGIN?.trim());
    if (url.protocol !== "https:" || url.username || url.password ||
        url.pathname !== "/" || url.search || url.hash) throw new Error();
    return url.origin;
  } catch {
    throw new HttpError(503, "community_hub_origin_not_configured");
  }
}
