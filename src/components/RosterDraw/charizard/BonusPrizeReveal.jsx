import { useCallback, useRef, useState } from 'react'
import { GiftBoxCanvas } from './GiftBoxCanvas.jsx'
import { BonusPrizeCopy } from './BonusPrizeCopy.jsx'
import './bonusPrize.css'

/** Receives an already-decided bonus winner. This component does not draw a winner. */
export function BonusPrizeReveal({ winner, textureUrl, cardTextureUrl, playing, runId, initialTime = 0, readPlaybackTime, view = 'reveal', onComplete, onReady, onError, cinematic = false, onProgress, seek, active = true }) {
  const stage = useRef(null)
  const [winnerVisible, setWinnerVisible] = useState(false)
  const [phase, setPhase] = useState('loading')
  const handlePhase = useCallback((visible) => setWinnerVisible(visible), [])
  const handleFrame = useCallback((pose) => {
    const style = stage.current?.style
    if (!style) return
    for (const property of ['introOpacity', 'titleOpacity', 'copyOpacity', 'winnerOpacity', 'handoff']) {
      const value = pose[property].toFixed(4)
      if (style.getPropertyValue(`--${property}`) !== value) style.setProperty(`--${property}`, value)
    }
  }, [])
  return (
    <section ref={stage} className={`bonus-stage${cinematic ? ' bonus-stage--cinematic' : ''}`} data-winner-visible={winnerVisible} data-phase={phase} data-playing={playing}>
      <div className="bonus-art">
        {!cinematic && <div className="bonus-floor-glow" aria-hidden="true" />}
        <GiftBoxCanvas active={active} textureUrl={textureUrl} cardTextureUrl={cardTextureUrl} playing={playing} runId={runId} initialTime={initialTime} readPlaybackTime={readPlaybackTime} view={view} onWinnerVisible={handlePhase} onComplete={onComplete} onReady={onReady} onError={onError} cinematic={cinematic} onPhaseChange={setPhase} onFrame={handleFrame} onProgress={onProgress} seek={seek} />
        <span className="bonus-art-caption">CHARIZARD <i /> 30TH ANNIVERSARY</span>
      </div>
      {cinematic && <div className="bonus-cinema-titles" aria-hidden="true">
        <div className="bonus-cinema-intro"><span>RENAISS · SPECIAL REVEAL</span><strong>火焰，即將甦醒。</strong><p>為這一刻，留下最炙熱的驚喜。</p></div>
        <div className="bonus-cinema-hero"><span>THE FLAME AWAKENS</span><strong>CHARIZARD</strong><p>噴火龍典藏公仔禮盒</p></div>
        <div className="bonus-cinema-vignette" />
      </div>}
      <BonusPrizeCopy cinematic={cinematic} winner={winner} winnerVisible={winnerVisible} playing={playing} />
    </section>
  )
}
