import { useEffect, useState } from 'react';
import { useLocale } from '../../i18n/LocaleContext';
import { exportSurfParticipants, readSurfParticipants, type ParticipantOverview } from '../../lib/surfParticipants';
import type { RecordedMissionTask, SurfParticipation } from '../RenaissHub/useSurfMissions';
import './SurfParticipants.css';

export function SurfParticipants() {
  const { locale } = useLocale(), zh = locale === 'zh-TW';
  const [data, setData] = useState<ParticipantOverview | null>(null);
  const [searchDraft, setSearchDraft] = useState(''), [search, setSearch] = useState('');
  const [page, setPage] = useState(1), [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true), [exporting, setExporting] = useState(false), [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(false);
    void readSurfParticipants(page, search).then(value => { if (active) setData(value); })
      .catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, search, revision]);
  async function exportRows(scope: 'eligible' | 'all') {
    setExporting(true); setError(false);
    try { await exportSurfParticipants(scope); setRevision(v => v + 1); }
    catch { setError(true); }
    finally { setExporting(false); }
  }
  const date = (value: string) => new Intl.DateTimeFormat(locale, {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
  return <div className="surf-participants">
    {data ? <div className="surf-participants__metrics">
      <div><span>{zh ? '參加者' : 'Participants'}</span><strong>{data.summary.participants}</strong></div>
      <div><span>{zh ? '持票參加者' : 'With tickets'}</span><strong>{data.summary.eligibleParticipants}</strong></div>
      <div><span>{zh ? '總票數' : 'Total tickets'}</span><strong>{data.summary.tickets}</strong></div>
    </div> : null}
    <div className="surf-participants__tools">
      <form onSubmit={event => { event.preventDefault(); setPage(1); setSearch(searchDraft.trim()); }}>
        <label className="surf-participants__search"><span>{zh ? '搜尋參加者' : 'Search participants'}</span><input value={searchDraft} onChange={event => setSearchDraft(event.target.value)} placeholder={zh ? '名字、錢包、X 或信箱' : 'Name, wallet, X or email'} /></label>
        <button type="submit">{zh ? '搜尋' : 'Search'}</button>
      </form>
      <div className="surf-participants__exports">
        <button type="button" disabled={exporting || loading || !data} onClick={() => void exportRows('eligible')}>{exporting ? (zh ? '匯出中…' : 'Exporting…') : (zh ? '匯出抽獎名單' : 'Export raffle entries')}</button>
        <button type="button" disabled={exporting || loading || !data} onClick={() => void exportRows('all')}>{zh ? '全部紀錄' : 'All records'}</button>
      </div>
    </div>
    {error ? <p className="surf-participants__error" role="alert">{zh ? '無法取得或匯出名單。請重新載入。' : 'Unable to load or export participants. Please retry.'}<button type="button" onClick={() => setRevision(v => v + 1)}>{zh ? '重試' : 'Retry'}</button></p> : null}
    {loading ? <p role="status">{zh ? '正在讀取參加紀錄…' : 'Loading participant records…'}</p> : null}
    {!loading && !error && data ? <>
      <div className="surf-participants__table" tabIndex={0} aria-label={zh ? 'Surf 抽獎參加名單' : 'Surf raffle participants'}>
        <table><thead><tr>{[zh ? '參加者／錢包' : 'Participant / wallet', 'X', 'Discord', zh ? '驗證紀錄' : 'Verification', zh ? '票數' : 'Tickets'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{data.rows.map(row => <tr key={row.userSub}>
            <td><strong>{row.name || '—'}</strong><span className="surf-participants__wallet">{row.walletAddress || (zh ? '尚未有錢包' : 'Wallet pending')}</span><span>{row.email || '—'}</span></td>
            <td>{row.xUsername ? <a href={`https://x.com/${encodeURIComponent(row.xUsername)}`} target="_blank" rel="noopener noreferrer">@{row.xUsername}</a> : '—'}{row.xUserId ? <small>ID {row.xUserId}</small> : null}</td>
            <td>{row.discordUsername || '—'}{row.discordUserId ? <small>ID {row.discordUserId}</small> : null}</td>
            <td><div className="surf-participants__checks">{(['accounts', 'x', 'discord'] as const).map(id => <TaskCheck key={id} task={row.tasks[id]} label={id === 'accounts' ? (zh ? '雙方帳號' : 'Accounts') : id === 'x' ? 'X' : 'Discord'} />)}</div><details><summary>{zh ? '查看時間' : 'View timestamps'}</summary>{(['accounts', 'x', 'discord'] as const).map(id => <p key={id}>{id === 'accounts' ? (zh ? '帳號' : 'Accounts') : id}: {row.tasks[id].verifiedAt ? date(row.tasks[id].verifiedAt!) : '—'}{row.tasks[id].outcome === 'unavailable' || row.tasks[id].outcome === 'reauthorize' ? <span>{zh ? '最近複查未完成' : 'Latest recheck incomplete'}</span> : null}</p>)}<p>{zh ? '更新' : 'Updated'} {date(row.updatedAt)}</p></details></td>
            <td><strong className="surf-participants__ticket-count">{row.ticketCount}</strong>{row.status !== 'eligible' ? <small>{participantStatus(row, zh)}</small> : null}</td>
          </tr>)}</tbody>
        </table>
        {!data.rows.length ? <p className="surf-participants__empty">{zh ? '尚無符合的參加紀錄。' : 'No matching participant records.'}</p> : null}
      </div>
      <div className="surf-participants__footer"><span>{zh ? `${data.total} 筆紀錄` : `${data.total} records`}</span><div><button type="button" disabled={page === 1} onClick={() => setPage(v => v - 1)}>{zh ? '上一頁' : 'Previous'}</button><span>{page} / {Math.max(1, Math.ceil(data.total / data.pageSize))}</span><button type="button" disabled={page * data.pageSize >= data.total} onClick={() => setPage(v => v + 1)}>{zh ? '下一頁' : 'Next'}</button></div></div>
      {data.latestExport ? <p className="surf-participants__saved">{zh ? '最近匯出' : 'Last export'} {date(data.latestExport.createdAt)} · {data.latestExport.participants} {zh ? '人' : 'participants'} · {data.latestExport.tickets} {zh ? '張票' : 'tickets'}</p> : null}
    </> : null}
    <p className="surf-participants__note">{zh ? '抽獎名單僅匯出有票數的參加者；每次匯出都會保留當次名單與票數快照。' : 'Raffle exports include only participants with tickets. Each export retains a snapshot of its participants and ticket counts.'}</p>
  </div>;
}

function TaskCheck({ task, label }: { task: RecordedMissionTask; label: string }) {
  return <span data-verified={task.verified}>{task.verified ? '✓' : '○'} {label}</span>;
}
function participantStatus(row: SurfParticipation, zh: boolean) {
  return row.status === 'wallet_required' ? (zh ? '待錢包' : 'Wallet pending') : row.status === 'wallet_already_registered' ? (zh ? '重複錢包' : 'Duplicate wallet') : (zh ? '待帳號驗證' : 'Accounts pending');
}
