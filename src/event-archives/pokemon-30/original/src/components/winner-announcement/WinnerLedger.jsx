import { Download } from 'lucide-react'
import { WinnerTransaction } from './WinnerTransaction'
import './winnerLedger.css'

export function WinnerLedger({ ledger, copy, locale }) {
  if (!ledger) return null
  const number = new Intl.NumberFormat(locale)
  return <section className="pokemon-winners-ledger" aria-label={copy.ledgerTitle}>
    <div className="pokemon-winners-ledger__summary">
      <div><h3>{copy.ledgerTitle}</h3><p>{copy.ledgerCounts
        .replace('{people}', number.format(ledger.eligibleWallets))
        .replace('{tickets}', number.format(ledger.totalTickets))}</p></div>
      <div className="pokemon-winners-ledger__links">
        <a className="pokemon-winners-ledger__download" href={ledger.downloadUrl} download="pokemon30-official-ticket-ledger.json">
          <Download size={14} aria-hidden="true" />{copy.downloadLedger}
        </a>
        <WinnerTransaction hash={ledger.transactionHash} label={copy.ledgerTransaction} />
        <WinnerTransaction hash={ledger.vrfTransactionHash} label={copy.vrfTransaction} />
      </div>
    </div>
    <details className="pokemon-winners-ledger__verification">
      <summary>{copy.verifyLedger}</summary>
      <p>{copy.ledgerExplanation}</p>
      <code>{ledger.ledgerHash}</code>
    </details>
  </section>
}
