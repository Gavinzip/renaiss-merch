import type { Winner } from './useSurfDraw';
import './SurfWinnerContacts.css';

export function SurfWinnerContacts({ participant }: { participant?: Winner['participant'] }) {
  if (!participant) return null;
  const rows = [
    ['Email', participant.email], ['X', participant.xUsername], ['Discord', participant.discordUsername],
  ].filter((row): row is [string, string] => typeof row[1] === 'string' && Boolean(row[1].trim()));
  if (!rows.length) return null;
  return <dl className="surf-winner-contacts">{rows.map(([label, value]) =>
    <div key={label}><dt>{label}</dt><dd>{label === 'X' ? `@${value.trim().replace(/^@/, '')}` : value.trim()}</dd></div>)}</dl>;
}
