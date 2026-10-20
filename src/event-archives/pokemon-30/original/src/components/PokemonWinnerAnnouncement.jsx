import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { usePokemon30I18n } from '../i18n/Pokemon30I18n'
import { winnerAnnouncementMessages } from '../i18n/winnerAnnouncementMessages'
import { BONUS_PRIZE_SLOT_INDEX } from '../../shared/drawPrizes.mjs'
import { WinnerIdentity } from './winner-announcement/WinnerIdentity'
import { ExtraWinnerAnnouncement } from './winner-announcement/ExtraWinnerAnnouncement'
import { WinnerTransaction } from './winner-announcement/WinnerTransaction'
import { WinnerLedger } from './winner-announcement/WinnerLedger'
import { useWinnerPrizeGallery } from './winner-announcement/useWinnerPrizeGallery'
import { PokemonPrizeStage } from './PokemonPrizeStage'
import './pokemonWinnerAnnouncement.css'

export function PokemonWinnerAnnouncement({ announcement, error }) {
  const { locale } = usePokemon30I18n()
  const copy = winnerAnnouncementMessages[locale]
  if (error) return <p className="pokemon-winners__error" role="status">{copy.unavailable}</p>
  if (!announcement) return null
  return <PublishedWinners announcement={announcement} locale={locale} copy={copy} />
}

function PrizeModel({ slotRef, state, rotate, copy }) {
  return <div className="pokemon-winners__model pokemon-winners__model--bonus">
    <div ref={slotRef} className="pokemon-winners__model-view" tabIndex={0} role="img"
      aria-label={copy.bonusModel} aria-busy={state === 'loading'}>
      {state !== 'ready' && <p className="pokemon-winners__model-status" role={state === 'error' ? 'alert' : 'status'}>
        {state === 'error' ? copy.modelError : copy.modelLoading}
      </p>}
    </div>
    <div className="pokemon-winners__model-controls">
      <button type="button" onClick={() => rotate(-1)} disabled={state !== 'ready'} aria-label={copy.rotateLeft}><ChevronLeft size={16} /></button>
      <span>{copy.inspectModel}</span>
      <button type="button" onClick={() => rotate(1)} disabled={state !== 'ready'} aria-label={copy.rotateRight}><ChevronRight size={16} /></button>
    </div>
  </div>
}

function PublishedWinners({ announcement, locale, copy }) {
  const sectionRef = useRef(null)
  const bonusRef = useRef(null)
  const gallery = useWinnerPrizeGallery(bonusRef)
  useEffect(() => {
    if (window.location.hash === '#winners') sectionRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
    if (window.location.hash === '#extra-winners') document.getElementById('extra-winners')?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [])
  const standard = announcement.winners.filter(winner => winner.prizeSlotIndex < BONUS_PRIZE_SLOT_INDEX)
  const bonus = announcement.winners.find(winner => winner.prizeSlotIndex === BONUS_PRIZE_SLOT_INDEX)
  const extras = announcement.extraWinners || []
  const publishedAt = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Taipei',
  }).format(new Date(announcement.publishedAt))
  return <section ref={sectionRef} className="pokemon-winners" id="winners" aria-labelledby="pokemon-winners-title">
    <div ref={gallery.hostRef} className="pokemon-winners__canvas" aria-hidden="true" />
    <header className="pokemon-winners__intro">
      <span>{copy.kicker}</span>
      <h2 id="pokemon-winners-title">{copy.heading.replace('{count}', announcement.winners.length + extras.length)}</h2>
      <p>{copy.intro}</p>
    </header>
    <WinnerLedger ledger={announcement.ledger} copy={copy} locale={locale} />
    <div className="pokemon-winners__standard">
      <figure className="pokemon-winners__product">
        <figcaption className="pokemon-winners__product-title"><span>PRIZE 01 — 10</span><h3>{copy.standardPrize}</h3><p>{copy.standardCount}</p></figcaption>
        <div className="pokemon-winners__flat-prize"><PokemonPrizeStage label={copy.standardImage} /></div>
        <div className="pokemon-winners__product-note"><span>30TH ANNIVERSARY</span><i />{copy.celebrationEdition}</div>
      </figure>
      <div className="pokemon-winners__roster">
        <div className="pokemon-winners__roster-heading"><h3>{copy.standardWinners}</h3><span>{copy.ticket}</span></div>
        <ol className="pokemon-winners__list">
          {standard.map(winner => <li className="pokemon-winners__row" key={winner.prizeSlotIndex}>
            <span className="pokemon-winners__number">{String(winner.prizeSlotIndex + 1).padStart(2, '0')}</span>
            <WinnerIdentity winner={winner} />
            <div className="pokemon-winners__result-proof"><span className="pokemon-winners__ticket">#{winner.ticketNumber}</span>
              <WinnerTransaction hash={winner.transactionHash} />
            </div>
          </li>)}
        </ol>
      </div>
    </div>
    {bonus && <section className="pokemon-winners__bonus" aria-labelledby="pokemon-winners-bonus-title">
      <div className="pokemon-winners__bonus-product">
        <span className="pokemon-winners__bonus-edition">THE ELEVENTH · CHARIZARD</span>
        <PrizeModel slotRef={bonusRef} state={gallery.status} rotate={gallery.rotate} copy={copy} />
      </div>
      <div className="pokemon-winners__bonus-copy">
        <span className="pokemon-winners__bonus-kicker"><i />{copy.bonus}</span>
        <h3 id="pokemon-winners-bonus-title">{copy.bonusPrize}</h3>
        <p className="pokemon-winners__bonus-description">{copy.bonusDescription}</p>
        <div className="pokemon-winners__bonus-winner"><span>{copy.bonusWinner}</span><WinnerIdentity winner={bonus} /></div>
        <div className="pokemon-winners__bonus-ticket"><span>{copy.ticket}</span><strong>#{bonus.ticketNumber}</strong></div>
        <WinnerTransaction hash={bonus.transactionHash} className="pokemon-winners__bonus-transaction" />
      </div>
    </section>}
    <ExtraWinnerAnnouncement winners={extras} copy={copy} />
    <p className="pokemon-winners__published">{copy.published} · <time dateTime={announcement.publishedAt}>{publishedAt}</time> (UTC+8)</p>
  </section>
}
