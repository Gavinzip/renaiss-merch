import type { Winner } from './useSurfDraw';
import './SurfWinnerContacts.css';

export function SurfWinnerContacts({ participant }: { participant?: Winner['participant'] }) {
  if (!participant) return null;
  const rows = [
    ['Email', participant.email], ['X', participant.xUsername], ['Discord', participant.discordUsername],
  ].filter((row): row is [string, string] => typeof row[1] === 'string' && Boolean(row[1].trim()));
  if (!rows.length) return null;
  return <dl className="surf-winner-contacts">{rows.map(([label, value]) => {
    const handle = label === 'X' ? value.trim().replace(/^@/, '') : '';
    const profileUrl = /^[A-Za-z0-9_]{1,15}$/.test(handle) ? `https://x.com/${handle}` : null;
    return <div key={label}><dt>{label}</dt><dd>{label === 'X'
      ? profileUrl ? <a href={profileUrl} target="_blank" rel="noopener noreferrer">@{handle}</a> : `@${handle}`
      : value.trim()}</dd></div>;
  })}</dl>;
}
