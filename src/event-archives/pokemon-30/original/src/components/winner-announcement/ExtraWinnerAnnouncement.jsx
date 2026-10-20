import { WinnerIdentity } from './WinnerIdentity'
import { WinnerTransaction } from './WinnerTransaction'
import './extraWinnerAnnouncement.css'

export function ExtraWinnerAnnouncement({ winners, copy }) {
  if (!winners.length) return null
  return <section className="pokemon-extra-winners" id="extra-winners" aria-labelledby="pokemon-extra-winners-title">
    <header className="pokemon-extra-winners__heading">
      <div><span>THE CELEBRATION CONTINUES</span><h3 id="pokemon-extra-winners-title">{copy.extraHeading}</h3></div>
      <p>{copy.extraCount.replace('{count}', winners.length)}</p>
    </header>
    <ol className="pokemon-extra-winners__list">
      {winners.map(winner => <li key={winner.extraPrizeIndex} className="pokemon-extra-winners__entry">
        <span className="pokemon-extra-winners__prize">{copy.extraPrize} {String(winner.extraPrizeIndex).padStart(2, '0')}</span>
        <WinnerIdentity winner={winner} />
        <div className="pokemon-extra-winners__ticket"><span>{copy.ticket}</span><strong>#{winner.ticketNumber}</strong></div>
        <WinnerTransaction hash={winner.transactionHash} />
      </li>)}
    </ol>
  </section>
}
