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
  const newestPost = feed.status === "ready" ? new Date(feed.cards[0]?.publishedAt) : null;
  const latestLabel = newestPost && !Number.isNaN(newestPost.valueOf())
    ? `${inlineCopy[locale].latestPost} ${newestPost.toLocaleDateString(locale, { month: "2-digit", day: "2-digit" })}`
    : "Community Hub";
  return (
    <article className={`renaiss-hub__card hub-feed hub-feed--${settings.source}`} data-size={hubWidgetSize(settings)}>
      <div className="renaiss-hub__card-heading">
        <span className="renaiss-hub__eyebrow">Community Hub</span>
        {feed.status === "ready" ? (
          <button className="hub-feed__live" type="button" onClick={onRetry} aria-label={inlineCopy[locale].refreshUpdates} title={inlineCopy[locale].latestSourcePostClickToRefresh}>
            <i />{settings.source === "official" && settings.project === "tcg" ? "@renaissxyz · " : ""}{latestLabel}
          </button>
        ) : null}
      </div>
      <h2>
        <HubMotionText>{copy.sources[settings.source]}</HubMotionText>
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
        <p className="hub-feed__state">{settings.source === 'events' ? inlineCopy[locale].noConfirmedUpcomingEventsCheckTheOfficial : copy.empty}</p>
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
                      <time dateTime={displayedDate} title={eventDate ? inlineCopy[locale].eventDate : inlineCopy[locale].publishedDate}>
                        {settings.source === "events" && !eventDate ? inlineCopy[locale].posted : ""}
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
    </article>
  );
}

const inlineCopy = {
  "en": {
    eventDate: 'Event date',
    publishedDate: 'Published date',
    latestPost: "Latest post",
    refreshUpdates: "Refresh updates",
    latestSourcePostClickToRefresh: "Latest source post; click to refresh",
    noConfirmedUpcomingEventsCheckTheOfficial: "No confirmed upcoming events. Check the official events page for updates.",
    posted: "Posted "
  },
  "zh-TW": {
    eventDate: '活動日期',
    publishedDate: '貼文日期',
    latestPost: "最新收錄",
    refreshUpdates: "重新整理動態",
    latestSourcePostClickToRefresh: "來源最新貼文日期；點擊重新整理",
    noConfirmedUpcomingEventsCheckTheOfficial: "目前沒有已確認可參與的活動，請查看官方活動頁取得最新消息。",
    posted: "公告 "
  },
  "ko": {
    eventDate: '활동 날짜',
    publishedDate: '게시일',
    latestPost: "최근 게시물",
    refreshUpdates: "소식 새로고침",
    latestSourcePostClickToRefresh: "최근 원본 게시물 날짜 · 클릭해 새로고침",
    noConfirmedUpcomingEventsCheckTheOfficial: "예정된 활동이 아직 확인되지 않았습니다. 공식 활동 페이지에서 최신 소식을 확인해 주세요.",
    posted: "게시일 "
  }
} as const;
