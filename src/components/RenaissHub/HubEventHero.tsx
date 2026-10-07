import { useEffect } from 'react';
import type { AppLocale } from '../../i18n/LocaleContext';
import type { CommunityCard } from './useCommunityFeed';
import { HubFeedImage } from './HubFeedImage';
import { useHubEventCarousel } from './useHubEventCarousel';

export function HubEventHero({ cards, locale, enabled }: { cards: CommunityCard[]; locale: AppLocale; enabled: boolean }) {
  const carousel = useHubEventCarousel(cards.map(card => card.id), enabled);
  const english = locale === 'en';
  const withoutImage = cards.filter(card => !card.imageUrl).map(card => card.id).join('|');
  useEffect(() => {
    if (withoutImage) withoutImage.split('|').forEach(carousel.markSettled);
  }, [withoutImage]);
  return <div className="hub-event-hero" ref={carousel.root} data-playing={carousel.playing}
    role="region" aria-roledescription={english ? 'carousel' : '輪播'} aria-label={english ? 'Event highlights' : '活動精選'}
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
          role="group" aria-roledescription={english ? 'slide' : '張'} aria-label={`${index + 1} / ${cards.length}`}>
          <a href={card.url} target="_blank" rel="noopener noreferrer" aria-label={`${card.title}${ended ? english ? ' · Ended' : ' · 已結束' : ''}`}>
            <div className="hub-event-hero__media">
              {card.imageUrl ? <HubFeedImage key={card.imageUrl} url={card.imageUrl} locale={locale} eager onSettled={() => carousel.markSettled(card.id)} />
                : <span className="hub-event-hero__missing">{english ? 'No image in the original post' : '原文未提供圖片'}</span>}
              {!Number.isNaN(date.valueOf()) ? <time dateTime={dateValue} title={english ? hasEventDate ? 'Event date' : 'Posted' : hasEventDate ? '活動日期' : '公告日期'}>{date.toLocaleDateString(locale,{month:'2-digit',day:'2-digit'})}</time> : null}
              {ended ? <span className="hub-event-hero__ended">{english ? 'Ended' : '已結束'}</span> : null}
              <span className="hub-event-hero__open" aria-hidden="true">↗</span>
            </div>
            <h3>{card.title}</h3>
          </a>
        </div>;
      })}
    </div>
    {cards.length > 1 ? <div className="hub-event-hero__controls">
      <div className="hub-event-hero__dots" aria-label={english ? 'Choose an event' : '選擇活動'}>
        {cards.map((card,index) => <button key={card.id} type="button" aria-label={`${english ? 'Event' : '活動'} ${index+1}：${card.title}`} aria-pressed={index===carousel.index}
          onClick={() => carousel.select(card.id)}><span /></button>)}
      </div>
      <span className="hub-event-hero__count" aria-hidden="true">{String(carousel.index+1).padStart(2,'0')} / {String(cards.length).padStart(2,'0')}</span>
      <div className="hub-event-hero__buttons">
        <button type="button" onClick={() => carousel.move(-1)} aria-label={english ? 'Previous event' : '上一則活動'}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12 5-5 5 5 5" /></svg></button>
        <button type="button" onClick={() => carousel.move(1)} aria-label={english ? 'Next event' : '下一則活動'}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m8 5 5 5-5 5" /></svg></button>
      </div>
    </div> : null}
  </div>;
}
