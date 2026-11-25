import { useArchiveEntrance } from './useArchiveEntrance';

export function ArchiveEntry({ children, className = '', delay = 0, stagger = .08 }) {
  const root = useArchiveEntrance(':scope > *', delay * 1000, stagger * 1000);
  return <div ref={root} className={className}>{children}</div>;
}
