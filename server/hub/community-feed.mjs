import { HttpError } from "../http.mjs";

// Read-only source shared with the website. JSON travels through this adapter;
// source links and media remain on their original host.
const WEBSITE_ORIGIN = "https://renaiss.zeabur.app";
const cache = new Map();
const pending = new Map();
const regionAccounts = {
  renaisstwcm: "tw",
  renaisskrcm: "kr",
  renaissmycm: "my",
  renaiss_vn: "vn",
  renaiss_th: "th",
};
const officialAccounts = {
  renaissxyz: "tcg",
  renaiss_index: "index",
  renaiss_fi: "defi",
  vinciwld: "game",
  tastedotmd: "hackathon",
  renaisscltb: "outreach",
};
const regions = new Set([
  "global",
  "tw",
  "kr",
  "my",
  "vn",
  "th",
  "multi_region",
  "unknown",
]);

export async function readCommunityFeed(locale) {
  if (!["en", "zh-TW"].includes(locale))
    throw new HttpError(400, "invalid_hub_language");
  const cached = cache.get(locale);
  if (cached && Date.now() - cached.fetchedAt < 60_000) return cached.feed;
  if (pending.has(locale)) return pending.get(locale);
  const request = fetchCommunityFeed(locale)
    .then((feed) => {
      cache.set(locale, { fetchedAt: Date.now(), feed });
      return feed;
    })
    .finally(() => pending.delete(locale));
  pending.set(locale, request);
  return request;
}

async function fetchCommunityFeed(locale) {
  try {
    const url = new URL("/api/intel/feed", WEBSITE_ORIGIN);
    url.searchParams.set("lang", locale === "zh-TW" ? "zh-Hant" : "en");
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (
      !response.ok ||
      !response.headers.get("content-type")?.includes("application/json")
    )
      throw new Error("invalid_feed_response");
    const chunks = [];
    let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > 5 * 1024 * 1024) throw new Error("feed_too_large");
      chunks.push(chunk);
    }
    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (payload.ok !== true || !Array.isArray(payload.feed?.cards))
      throw new Error("invalid_feed_payload");
    const feed = payload.feed;
    const projectMap = Object.fromEntries(
      Object.entries(feed.account_projects || {}).map(([account, project]) => [
        account.toLowerCase(),
        project,
      ]),
    );
    const cards = feed.cards
      .filter(
        (card) =>
          card &&
          card.dedupe_status !== "dropped" &&
          (locale === "zh-TW" || card._i18n_status?.status === "translated"),
      )
      .map((card) => adaptCard(card, projectMap))
      .filter((card) => card.title && card.url)
      .sort(
        (a, b) =>
          (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0),
      );
    return {
      cards,
      generatedAt: text(feed.generated_at, 80),
      websiteUrl: `${WEBSITE_ORIGIN}/community-hub/`,
    };
  } catch {
    // Never disguise an upstream failure with demo or stale posts.
    throw new HttpError(502, "community_feed_unavailable");
  }
}

function adaptCard(card, projectMap) {
  const account = text(card.account, 100).replace(/^@+/, "");
  const normalized = account.toLowerCase();
  const project = projectMap[normalized] || officialAccounts[normalized] || "";
  const role = ["official", "official_community", "other"].includes(
    card.source_role,
  )
    ? card.source_role
    : project
      ? "official"
      : regionAccounts[normalized]
        ? "official_community"
        : "other";
  const region =
    card.card_type === "event"
      ? regions.has(card.event_region)
        ? card.event_region
        : "unknown"
      : regionAccounts[normalized] ||
        (role === "official" ? "global" : "unknown");
  return {
    id: text(card.id, 150) || safeUrl(card.url),
    title: text(card.title || card.article_title, 260),
    summary: text(card.glance || card.summary, 360),
    url: safeUrl(card.url),
    account,
    project,
    role,
    region,
    type: text(card.card_type, 40),
    publishedAt: text(card.published_at, 80),
    storyId: text(card.dedupe_winner_post_id || card.product_progress_group_key, 150),
    storyTags: Array.isArray(card.tags) ? card.tags.filter(tag => typeof tag === "string").slice(0, 20).map(tag => text(tag, 100)) : [],
    eventStart: text(card.timeline_date, 80),
    eventEnd: text(card.timeline_end_date, 80),
    eventStatus: text(card.event_status, 40),
    effectiveEventDate: text(card.effective_event_date, 80),
    // Use the published cover, never a fabricated or generated placeholder.
    imageUrl: coverUrl(card.cover_image),
  };
}
function coverUrl(value) {
  if (typeof value === "string" && value.startsWith("/data/generated_covers/")) {
    return new URL(value, WEBSITE_ORIGIN).href;
  }
  return safeUrl(value);
}

function text(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}
