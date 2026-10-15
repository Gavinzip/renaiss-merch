import { RosterUpload } from './RosterUpload';
import { RosterStatus } from './RosterStatus';
import { useRosterDraw } from './useRosterDraw';
import { drawRoomHashes } from './drawRoomRoute';
import './RosterDrawRoom.css';
import './RosterManagement.css';

export function RosterManagementPage({ draw }: { draw: ReturnType<typeof useRosterDraw> }) {
  const roster = draw.state?.roster;
  const winners = draw.state?.winners ?? [];
  const wonIds = new Set(winners.map(winner => winner.entryId));
  return <section className="roster-room roster-manager" aria-labelledby="roster-manager-title">
    <header className="roster-room__header">
      <div>
        <span className="roster-eyebrow">RENAISS · DRAW ROSTER</span>
        <h1 id="roster-manager-title" tabIndex={-1}>名單管理</h1>
        <p>噴火龍與額外加碼共用這份名單。上傳並確認後，即可回到抽獎頁。</p>
      </div>
    </header>
    <RosterStatus state={draw.state} refreshing={draw.refreshing} error={draw.error}
      disabled={draw.busy} onRefresh={draw.refresh} manage={false} />
    {draw.error ? <p className="roster-error" role="alert">{draw.error}</p> : null}
    {draw.state ? <div className="roster-manager__content">
      <div>
        <RosterUpload key={roster?.id ?? 'empty'} locked={winners.length > 0}
          busy={draw.busy || draw.refreshing || draw.retryPending} hasRoster={Boolean(roster)}
          onUpload={draw.upload} onClear={draw.clear} />
        {roster ? <details className="roster-entries">
          <summary>查看已上傳名單 · {roster.entries.length.toLocaleString()} 個名額</summary>
          <div>{roster.entries.map(entry => <p key={entry.id}>
            <code>{entry.id}</code><span>{entry.name}</span>{wonIds.has(entry.id) ? <small>已中獎</small> : null}
          </p>)}</div>
          <small>名單指紋 {roster.hash}</small>
        </details> : null}
      </div>
      <aside className="roster-manager__note">
        <h2>抽獎前準備</h2>
        <p>每列為一個抽獎名額，中過任一獎項後，就會從共用名單排除。</p>
        <p>開始抽獎後名單鎖定；清空目前名單即可開始新一輪。</p>
        {roster ? <p className="roster-manager__saved" role="status">已儲存至伺服器。抽獎頁重新整理或點選「重新讀取」，就會取得最新名單。</p> : null}
      </aside>
    </div> : null}
    <nav className="roster-manager__destinations" aria-label="前往抽獎">
      <a href={drawRoomHashes.charizard}>噴火龍抽獎 <span aria-hidden="true">↗</span></a>
      <a href={drawRoomHashes.other}>額外加碼 <span aria-hidden="true">↗</span></a>
    </nav>
  </section>;
}
