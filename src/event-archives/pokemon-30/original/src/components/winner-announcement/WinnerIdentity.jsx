export function WinnerIdentity({ winner }) {
  const identity = winner.displayName || winner.xHandle || winner.walletAddressMasked
  const profile = winner.xHandle && <a href={'https://x.com/' + winner.xHandle.slice(1)} target="_blank" rel="noreferrer">{winner.xHandle}</a>
  return <div className="pokemon-winners__identity">
    <strong>{identity === winner.xHandle ? profile : identity}</strong>
    {winner.xHandle && identity !== winner.xHandle ? profile : <small>{winner.walletAddressMasked}</small>}
  </div>
}
