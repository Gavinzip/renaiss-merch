function PrizeWinner({ winner, visible, playing }) {
  return <div className="bonus-winner-space" aria-live="polite">
    {visible && winner ? <div className="bonus-winner">
      <p>恭喜獲得典藏禮盒 <span>名單抽獎</span></p>
      <strong>{winner.displayName || winner.xHandle || winner.walletAddressMasked}</strong>
      {winner.xHandle && <span className="bonus-winner-handle">{winner.xHandle}</span>}
    </div> : <p className="bonus-waiting">{playing ? '幸運得主，即將揭曉。' : '一份典藏，獻給幸運的你。'}</p>}
  </div>
}

export function BonusPrizeCopy({ cinematic, winner, winnerVisible, playing }) {
  const winnerBlock = <PrizeWinner winner={winner} visible={winnerVisible} playing={playing} />
  return <div className="bonus-copy">
    <p className="bonus-eyebrow">{cinematic ? 'RENAISS · CHARIZARD' : 'THE FINAL CELEBRATION'}</p>
    <h1>{cinematic ? <em>此刻，屬於你。</em> : '最後一份驚喜。'}</h1>
    {cinematic && winnerBlock}
    <div className="bonus-prize-details">
      <p className="bonus-description">噴火龍典藏公仔禮盒</p>
      <p className="bonus-contents">公仔 × 1 · 特大卡牌 × 1 · 補充包 × 15</p>
      <div className="bonus-prize-tag">RENAISS SPECIAL <i /> 一份幸運</div>
    </div>
    {!cinematic && winnerBlock}
  </div>
}
