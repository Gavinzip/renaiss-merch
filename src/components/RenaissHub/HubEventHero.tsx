import { useEffect } from 'react';
import type { AppLocale } from '../../i18n/LocaleContext';
import type { CommunityCard } from './useCommunityFeed';
import { HubFeedImage } from './HubFeedImage';
import { useHubEventCarousel } from './useHubEventCarousel';

export function HubEventHero({ cards, locale, enabled }: { cards: CommunityCard[]; locale: AppLocale; enabled: boolean }) {
  const carousel = useHubEventCarousel(cards.map(card => card.id), enabled);
  const withoutImage = cards.filter(card => !card.imageUrl).map(card => card.id).join('|');
  useEffect(() => {
    if (withoutImage) withoutImage.split('|').forEach(carousel.markSettled);
  }, [withoutImage]);
  return <div className="hub-event-hero" ref={carousel.root} data-playing={carousel.playing}
    role="region" aria-roledescription={inlineCopy[locale].carousel} aria-label={inlineCopy[locale].eventHighlights}
    onPointerEnter={event => { if (event.pointerType === 'mouse') carousel.setHovered(true); }}
    onPointerLeave={() => carousel.setHovered(false)}
    onFocusCapture={() => carousel.setFocused(true)}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) carousel.setFocused(false); }}>
    <div className="hub-event-hero__stage" aria-live={carousel.playing ? 'off' : 'polite'}>
      {cards.map((card, index) => {
        const active = card.id === carousel.active;
        const dateValue = card.effectiveEventDate || card.eventStart || card.eventEnd || card.publishedAt;
        const date = new Date(dateValue);
        const ended = card.eventStatus === 'ended';
        const hasEventDate = Boolean(card.effectiveEventDate || card.eventStart || card.eventEnd);
        return <div key={card.id} className="hub-event-hero__slide" data-active={active} aria-hidden={!active} inert={!active}
          role="group" aria-roledescription={inlineCopy[locale].slide} aria-label={`${index + 1} / ${cards.length}`}>
          <a href={card.url} target="_blank" rel="noopener noreferrer" aria-label={`${card.title}${ended ? inlineCopy[locale].ended : ''}`}>
            <div className="hub-event-hero__media">
              {card.imageUrl ? <HubFeedImage key={card.imageUrl} url={card.imageUrl} locale={locale} eager onSettled={() => carousel.markSettled(card.id)} />
                : <span className="hub-event-hero__missing">{inlineCopy[locale].noImageInTheOriginalPost}</span>}
              {!Number.isNaN(date.valueOf()) ? <time dateTime={dateValue} title={hasEventDate ? inlineCopy[locale].eventDate : inlineCopy[locale].posted}>{date.toLocaleDateString(locale,{month:'2-digit',day:'2-digit'})}</time> : null}
              {ended ? <span className="hub-event-hero__ended">{inlineCopy[locale].ended2}</span> : null}
              <span className="hub-event-hero__open" aria-hidden="true">↗</span>
            </div>
            <h3>{card.title}</h3>
          </a>
        </div>;
      })}
    </div>
    {cards.length > 1 ? <div className="hub-event-hero__controls">
      <div className="hub-event-hero__dots" aria-label={inlineCopy[locale].chooseAnEvent}>
        {cards.map((card,index) => <button key={card.id} type="button" aria-label={`${inlineCopy[locale].event} ${index+1}：${card.title}`} aria-pressed={index===carousel.index}
          onClick={() => carousel.select(card.id)}><span /></button>)}
      </div>
      <span className="hub-event-hero__count" aria-hidden="true">{String(carousel.index+1).padStart(2,'0')} / {String(cards.length).padStart(2,'0')}</span>
      <div className="hub-event-hero__buttons">
        <button type="button" onClick={() => carousel.move(-1)} aria-label={inlineCopy[locale].previousEvent}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12 5-5 5 5 5" /></svg></button>
        <button type="button" onClick={() => carousel.move(1)} aria-label={inlineCopy[locale].nextEvent}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m8 5 5 5-5 5" /></svg></button>
      </div>
    </div> : null}
  </div>;
}

const inlineCopy = {
  "en": {
    eventDate: 'Event date',
    posted: 'Posted',
    carousel: "carousel",
    eventHighlights: "Event highlights",
    slide: "slide",
    ended: " · Ended",
    noImageInTheOriginalPost: "No image in the original post",
    ended2: "Ended",
    chooseAnEvent: "Choose an event",
    event: "Event",
    previousEvent: "Previous event",
    nextEvent: "Next event"
  },
  "zh-TW": {
    eventDate: '活動日期',
    posted: '公告日期',
    carousel: "輪播",
    eventHighlights: "活動精選",
    slide: "張",
    ended: " · 已結束",
    noImageInTheOriginalPost: "原文未提供圖片",
    ended2: "已結束",
    chooseAnEvent: "選擇活動",
    event: "活動",
    previousEvent: "上一則活動",
    nextEvent: "下一則活動"
  },
  "ko": {
    eventDate: '활동 날짜',
    posted: '게시일',
    carousel: "캐러셀",
    eventHighlights: "활동 하이라이트",
    slide: "슬라이드",
    ended: " · 종료",
    noImageInTheOriginalPost: "원본 게시물에 이미지가 없습니다",
    ended2: "종료",
    chooseAnEvent: "활동 선택",
    event: "활동",
    previousEvent: "이전 활동",
    nextEvent: "다음 활동"
  }
} as const;
