import { useCallback, useEffect, useState } from "react";
import type { AppLocale } from "../../i18n/LocaleContext";
import type { HubFeedWidget } from "../../../shared/hub-preferences.js";
import { distinctCommunityStories } from "../../../shared/community-stories.js";

export type CommunityCard = {
  id: string;
  title: string;
  summary: string;
  url: string;
  account: string;
  project: string;
  role: string;
  region: string;
  type: string;
  publishedAt: string;
  imageUrl: string;
  storyId?: string;
  storyTags?: string[];
  eventStart?: string;
  eventEnd?: string;
};
export type CommunityFeedState =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready";
      cards: CommunityCard[];
      generatedAt: string;
      websiteUrl: string;
    };

export function useCommunityFeed(locale: AppLocale, enabled: boolean) {
  const [state, setState] = useState<CommunityFeedState>({ status: "loading" });
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setState({ status: "loading" });
    void fetch(`/api/hub/feed?lang=${locale}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("feed_unavailable");
        const feed = (await response.json()) as Omit<
          Extract<CommunityFeedState, { status: "ready" }>,
          "status"
        >;
        if (!Array.isArray(feed.cards)) throw new Error("invalid_feed");
        if (!controller.signal.aborted) setState({ status: "ready", ...feed });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "error" });
      });
    return () => controller.abort();
  }, [locale, revision, enabled]);
  useEffect(() => {
    if (!enabled) return;
    const interval = window.setInterval(() => {
      if (!document.hidden) retry();
    }, 5 * 60_000);
    return () => window.clearInterval(interval);
  }, [enabled, retry]);
  return { state, retry };
}

export function selectCommunityCards(
  cards: CommunityCard[],
  settings: HubFeedWidget,
) {
  const matching = cards
    .filter((card) => {
      const sourceMatches =
        settings.source === "all" ||
        (settings.source === "official" &&
          card.role === "official" &&
          card.type !== "event") ||
        (settings.source === "community" && card.role !== "official") ||
        (settings.source === "events" && card.type === "event") ||
        (settings.source === "products" &&
          card.type === "product_progress" &&
          card.role === "official");
      return (
        sourceMatches &&
        (settings.source !== "official" || settings.project !== "tcg" || card.account.replace(/^@/, "").toLowerCase() === "renaissxyz") &&
        (settings.project === "all" || settings.project === card.project) &&
        (settings.region === "all" || settings.region === card.region)
      );
    });
  const ordered = settings.source === "events"
    ? [...matching].sort((a, b) => Date.parse(b.eventStart || b.publishedAt) - Date.parse(a.eventStart || a.publishedAt))
    : matching;
  const distinct = distinctCommunityStories(ordered);
  if (settings.source !== "events") distinct.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  return distinct.slice(0, settings.count);
}
