import type { ReactNode } from 'react';
import './DrawRoomLayout.css';

export function DrawRoomHeading({ title, eyebrow, subtitle, status, id }: {
  title: string;
  eyebrow: ReactNode;
  subtitle?: ReactNode;
  status?: ReactNode;
  id?: string;
}) {
  return <header className="surf-draw-masthead draw-room-heading">
    <div>
      <span className="draw-room-heading__eyebrow">{eyebrow}</span>
      <h1 id={id} tabIndex={id ? -1 : undefined}>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
    {status ? <div className="draw-room-heading__status">{status}</div> : null}
  </header>;
}
