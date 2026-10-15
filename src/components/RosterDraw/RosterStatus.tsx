import { drawRoomHashes } from './drawRoomRoute';
import type { RosterState } from './types';
import './RosterManagement.css';

export function RosterStatus({ state, refreshing, error, disabled = false, onRefresh, manage = true, compact = false }: {
  state: RosterState | null;
  refreshing: boolean;
  error: string;
  disabled?: boolean;
  onRefresh: () => Promise<void>;
  manage?: boolean;
  compact?: boolean;
}) {
  const roster = state?.roster;
  const status = refreshing ? '讀取中' : error ? '讀取失敗' : !state ? '尚未讀取' : roster ? '已上傳' : '未上傳';
  return <section className="roster-status" aria-label="抽獎名單狀態" aria-busy={refreshing}>
    <div className="roster-status__detail" role="status">
      <span className="roster-status__label" data-ready={Boolean(roster && !error)}>
        <i aria-hidden="true" />名單{status}
      </span>
      {roster && !compact ? <span className="roster-status__summary">
        {roster.title}<small>{roster.entries.length.toLocaleString()} 個名額 · {state!.winners.length} 個已中獎</small>
      </span> : null}
    </div>
    <div className="roster-status__actions">
      <button type="button" disabled={disabled || refreshing} onClick={() => void onRefresh()}>
        {refreshing ? '讀取中…' : '重新讀取'} <span aria-hidden="true">↻</span>
      </button>
      {manage && !compact && !disabled ? <a href={drawRoomHashes.roster}>名單管理 <span aria-hidden="true">↗</span></a> : null}
    </div>
  </section>;
}
