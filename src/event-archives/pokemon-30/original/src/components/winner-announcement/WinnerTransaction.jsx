import { ArrowUpRight } from 'lucide-react'

export function WinnerTransaction({ hash, label = 'Transaction', className = '' }) {
  if (!/^0x[\da-f]{64}$/i.test(hash || '')) return null
  return <a className={`pokemon-winners__transaction ${className}`} href={`https://bscscan.com/tx/${hash}`}
    target="_blank" rel="noreferrer" aria-label={`${label} · ${hash}`} title={hash}>
    {label}<ArrowUpRight size={12} aria-hidden="true" />
  </a>
}
