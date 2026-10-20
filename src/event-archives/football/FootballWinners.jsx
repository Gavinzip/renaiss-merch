import { useEffect, useMemo, useRef, useState } from 'react';
import { Award, CirclePlay, Gift, RotateCcw } from 'lucide-react';
import { archiveAssetUrl } from '../shared/archiveAssets';
import { useCampaignCopy } from './original/src/app/i18n/useCampaignCopy';
import { buildWinnerRoundGroups, buildWinnerRoundOptions, WinnerOnChainProof, WinnerRevealRow } from './original/src/app/components/control-room/WinnersRoom';
import { getMatchPrizeImageByMatchId } from './original/src/app/data/matchPrizeImages';
import SideRays from './original/src/app/components/SideRays/SideRays';

// Original public reveal film; this permanent CDN asset is loaded only in this room.
const revealVideo = 'https://pub-7230fa99c50e44e9b241e47cac526165.r2.dev/draw/winner-reveal-2026-06-17-hq.mp4';
const backdrop = archiveAssetUrl('football/src/app/assets/championship-trophy-renaiss-mark.webp');
export default function FootballWinners({ activeRoundId, onSelectRound, data, rounds, matches }) {
  const { t, roundLabel } = useCampaignCopy();
  const video = useRef(null);
  const [revealed, setRevealed] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const [proofOpen, setProofOpen] = useState(false);
  const [issue, setIssue] = useState('');
  const groups = useMemo(() => buildWinnerRoundGroups(data.winners, rounds, matches, t, roundLabel), [data, rounds, matches, t, roundLabel]);
  const options = useMemo(() => buildWinnerRoundOptions(groups, rounds, t, roundLabel), [groups, rounds, t, roundLabel]);
  const round = options.find(option => option.id === activeRoundId);
  const roundData = data.roundSnapshots.find(snapshot => snapshot.roundId === activeRoundId);
  const winners = round.winners;
  const selected = winners.find(({winner}) => winner.id === selectedId) || winners[Math.max(0, Math.min(visibleCount - 1, winners.length - 1))];
  const showPrize = revealed && Boolean(selected);
  const prizeImage = selected ? selected.prizeImage : getMatchPrizeImageByMatchId('', matches, activeRoundId);
  const prizeTitle = t('winnerReveal.cardPrizeMatchTitle', {match: selected?.matchLabel || round.label});
  useEffect(() => {
    setSelectedId(''); setProofOpen(false); setVisibleCount(0);
    if (!revealed) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setVisibleCount(winners.length); return; }
    let count = 0;
    const timer = setInterval(() => { count += 1; setVisibleCount(count); if (count >= winners.length) clearInterval(timer); }, 560);
    return () => clearInterval(timer);
  }, [revealed, activeRoundId, winners.length]);
  useEffect(() => {
    const element = video.current;
    return () => { if (element) { element.pause(); element.removeAttribute('src'); element.load(); } };
  }, []);
  function replay() { setRevealed(false); setVisibleCount(0); setSelectedId(''); video.current.currentTime = 0; video.current.play().catch(() => setIssue(t('winnerReveal.videoIssue'))); }
  return <section className={'winners-room has-winners ' + (revealed ? 'is-reveal' : 'is-intro')} aria-label={t('winnerReveal.roomAria')}>
    <div className="winner-stage-presentation">
      <section className="round-simulator is-rail-only winner-round-simulator" aria-label={t('common.round')}>
        <ol className="round-switch round-switch--read-only" aria-label={t('common.round')}>
          {options.map(option => <li key={option.id}
            className={['round-switch__item', 'is-inspectable', activeRoundId===option.id?'is-active':'', option.id==='final'?'is-final-round':''].join(' ')}
            aria-current={activeRoundId===option.id?'step':undefined}>
            <button className="round-switch__stage" type="button" aria-pressed={activeRoundId===option.id} onClick={() => onSelectRound(option.id)}>
              <span className="round-switch__label">{option.label}</span>
              <strong className="round-switch__metric"><span>{option.winners.length}</span><small>{t('roundRail.matchUnit')}</small></strong>
              <span className="round-switch__track" aria-hidden="true"/>
            </button>
          </li>)}
        </ol>
      </section>
      <video ref={video} className="winner-stage-video" src={revealVideo} muted playsInline autoPlay preload="auto" onEnded={() => setRevealed(true)} onError={() => setIssue(t('winnerReveal.videoIssue'))}/>
      <div className="winner-stage-reveal-bg" style={{backgroundImage: showPrize ? 'none' : `url(${backdrop})`}} aria-hidden="true"/>
      <div className="winner-stage-grid" aria-hidden="true"/>
      {revealed && <div className="winner-stage-side-rays" aria-hidden="true"><SideRays speed={2.5} rayColor1="#EAB308" rayColor2="#96c8ff" intensity={2} spread={2} origin="top-left" tilt={0} saturation={1.5} blend={0.75} falloff={1.6} opacity={1}/></div>}
      <div className="winner-stage-scrim" aria-hidden="true"/>
      <section className="winner-stage-intro" aria-hidden={revealed}><span><Award size={16}/>{t('winnerReveal.eyebrow')}</span><h1>{t('winnerReveal.title')}</h1></section>
      <section className="winner-stage-actions" aria-label={t('winnerReveal.controlsAria')}>{!revealed ? <button type="button" onClick={() => { video.current.pause(); setRevealed(true); }}><CirclePlay size={16}/>{t('winnerReveal.skipVideo')}</button> : <button type="button" onClick={replay}><RotateCcw size={16}/>{t('winnerReveal.replay')}</button>}</section>
      <section className={'winner-stage-reveal' + (showPrize ? ' has-prize-card' : '')} aria-hidden={!revealed}>
        <div className="winner-stage-primary">
          {showPrize && <section className="winner-stage-prize-card" aria-label={t('winnerReveal.cardPrizeAria')}><span className="winner-stage-prize-card__image"><img src={prizeImage} alt="" decoding="async"/></span><span className="winner-stage-prize-card__copy"><span><Gift size={15}/>{t('winnerReveal.cardPrizeLabel')}</span><strong>{prizeTitle}</strong><p>{t('winnerReveal.cardPrizeBody')}</p></span></section>}
          <section className="winner-stage-board" aria-label={t('winnerReveal.listAria')}>
            <section className="winner-reveal-list" aria-label={t('winnerReveal.selectedRoundListAria',{round:round.label})}><section className="winner-round-group" aria-label={round.label}><header className="winner-round-group__head"><span>{round.label}</span><em>{t('winnerReveal.roundGroupCount',{count:winners.length})}</em></header><ol>{winners.map(({winner,matchLabel,prizeImage},index) => <WinnerRevealRow key={winner.id} winner={winner} index={index} matchLabel={matchLabel} prizeImage={prizeImage} visible={revealed && index<visibleCount} selected={selected?.winner.id===winner.id} active={selected?.winner.id===winner.id} onSelect={() => setSelectedId(winner.id)}/>)}</ol></section></section>
            <WinnerOnChainProof winnerRevealData={roundData} selectedRound={round} selectedActiveWinner={selected} matches={matches} open={proofOpen} onToggle={() => setProofOpen(value => !value)}/>
          </section>
        </div>
      </section>
      {issue && <p className="winner-stage-issue" role="alert">{issue}</p>}
    </div>
  </section>;
}
