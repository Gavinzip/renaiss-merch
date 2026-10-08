import type { AppLocale } from "../../i18n/LocaleContext";
import { hubWidgetSize, type HubFeedWidget } from "../../../shared/hub-preferences.js";
import { HubFeedImage } from "./HubFeedImage";
import { HubMotionText } from "./HubMotionText";
import { HubEventHero } from "./HubEventHero";
import type { HubWidgetCopy } from "./HubWidgetCopy";
import {
  selectCommunityCards,
  type CommunityFeedState,
} from "./useCommunityFeed";

const routes = {
  all: "feed",
  official: "official",
  community: "feed",
  events: "events",
  products: "future",
};

export function HubCommunityWidget({
  settings,
  feed,
  locale,
  copy,
  onRetry,
  editing = false,
  preview = false,
}: {
  settings: HubFeedWidget;
  feed: CommunityFeedState;
  locale: AppLocale;
  copy: HubWidgetCopy;
  onRetry: () => void;
  editing?: boolean;
  preview?: boolean;
}) {
  const cards =
    feed.status === "ready"
      ? selectCommunityCards(feed.cards, settings)
      : [];
  const websiteUrl =
    feed.status === "ready"
      ? feed.websiteUrl
      : "https://renaiss.zeabur.app/community-hub/";
  const newestPost = feed.status === "ready" ? new Date(feed.cards[0]?.publishedAt) : null;
  const latestLabel = newestPost && !Number.isNaN(newestPost.valueOf())
    ? `${locale === "en" ? "Latest post" : "最新收錄"} ${newestPost.toLocaleDateString(locale, { month: "2-digit", day: "2-digit" })}`
    : locale === "en" ? "Community Hub" : "Community Hub";
  return (
    <article className={`renaiss-hub__card hub-feed hub-feed--${settings.source}`} data-size={hubWidgetSize(settings)}>
      <div className="renaiss-hub__card-heading">
        <span className="renaiss-hub__eyebrow">Community Hub</span>
        {feed.status === "ready" ? (
          <button className="hub-feed__live" type="button" onClick={onRetry} aria-label={locale === "en" ? "Refresh updates" : "重新整理動態"} title={locale === "en" ? "Latest source post; click to refresh" : "來源最新貼文日期；點擊重新整理"}>
            <i />{settings.source === "official" && settings.project === "tcg" ? "@renaissxyz · " : ""}{latestLabel}
          </button>
        ) : null}
      </div>
      <h2>
        <a className="hub-title-action" href={`${websiteUrl}#${routes[settings.source]}`} target="_blank" rel="noopener noreferrer">
          <HubMotionText>{copy.sources[settings.source]}</HubMotionText>
        </a>
      </h2>
      <div className="hub-feed__filters">
        <span>{copy.projects[settings.project]}</span>
        {settings.region !== "all" ? (
          <span>{copy.regions[settings.region]}</span>
        ) : null}
      </div>
      {feed.status === "loading" ? (
        <div className="hub-feed__state" role="status">
          <span className="hub-feed__loader" />
          {copy.loading}
        </div>
      ) : feed.status === "error" ? (
        <div className="hub-feed__state" role="alert">
          <p>{copy.error}</p>
          <button type="button" onClick={onRetry}>
            {copy.retry} ↗
          </button>
        </div>
      ) : cards.length === 0 ? (
        <p className="hub-feed__state">{settings.source === 'events' ? locale === 'zh-TW' ? '目前沒有已確認可參與的活動，請查看官方活動頁取得最新消息。' : 'No confirmed upcoming events. Check the official events page for updates.' : copy.empty}</p>
      ) : settings.source === "events" ? (
        <HubEventHero cards={cards} locale={locale} enabled={!editing && !preview} />
      ) : (
        <ul className="hub-feed__posts">
          {cards.map((card) => {
            const eventDate = settings.source === "events" && card.eventStart;
            const displayedDate = eventDate || card.publishedAt;
            const date = new Date(displayedDate);
            return (
              <li key={card.id}>
                <a
                  href={card.url}
                  aria-label={card.title}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {hubWidgetSize(settings) !== "small" && card.imageUrl ? <HubFeedImage key={card.imageUrl} url={card.imageUrl} locale={locale} /> : null}
                  <div className="hub-feed__post-body">
                  <div className="hub-feed__post-meta">
                    <span>
                      {settings.source === "community" ? (
                        <i className="hub-feed__avatar" aria-hidden="true">{(card.account || "R").slice(0, 1).toUpperCase()}</i>
                      ) : null}
                      {card.account ? `@${card.account}` : "Community Hub"}
                    </span>
                    {!Number.isNaN(date.valueOf()) ? (
                      <time dateTime={displayedDate} title={locale === "en" ? eventDate ? "Event date" : "Published date" : eventDate ? "活動日期" : "貼文日期"}>
                        {settings.source === "events" && !eventDate ? locale === "en" ? "Posted " : "公告 " : ""}
                        {date.toLocaleDateString(locale, {
                          month: "2-digit",
                          day: "2-digit",
                        })}
                      </time>
                    ) : null}
                  </div>
                  <div className="hub-feed__post-heading">
                    <h3>{card.title}</h3>
                    <svg viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M5 15 15 5M5 5h10v10" />
                    </svg>
                  </div>
                  <p>{card.summary}</p>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      )}
      <a
        className="hub-feed__website"
        href={`${websiteUrl}#${routes[settings.source]}`}
        target="_blank"
        rel="noopener noreferrer"
        title={feed.status === "ready" ? feed.generatedAt : undefined}
      >
        <span className="hub-action-label">{copy.website}</span>
        <span aria-hidden="true">↗</span>
      </a>
    </article>
  );
}
