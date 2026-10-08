import { useEffect, useState } from 'react';
import { useLocale, type AppLocale } from '../../i18n/LocaleContext';
import { exportSurfParticipants, readSurfParticipants, type ParticipantOverview } from '../../lib/surfParticipants';
import type { RecordedMissionTask, SurfParticipation } from '../RenaissHub/useSurfMissions';
import './SurfParticipants.css';

export function SurfParticipants() {
  const { locale } = useLocale();
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
      <div><span>{inlineCopy[locale].participants}</span><strong>{data.summary.participants}</strong></div>
      <div><span>{inlineCopy[locale].withTickets}</span><strong>{data.summary.eligibleParticipants}</strong></div>
      <div><span>{inlineCopy[locale].totalTickets}</span><strong>{data.summary.tickets}</strong></div>
    </div> : null}
    <div className="surf-participants__tools">
      <form onSubmit={event => { event.preventDefault(); setPage(1); setSearch(searchDraft.trim()); }}>
        <label className="surf-participants__search"><span>{inlineCopy[locale].searchParticipants}</span><input value={searchDraft} onChange={event => setSearchDraft(event.target.value)} placeholder={inlineCopy[locale].nameWalletXOrEmail} /></label>
        <button type="submit">{inlineCopy[locale].search}</button>
      </form>
      <div className="surf-participants__exports">
        <button type="button" disabled={exporting || loading || !data} onClick={() => void exportRows('eligible')}>{exporting ? (inlineCopy[locale].exporting) : (inlineCopy[locale].exportRaffleEntries)}</button>
        <button type="button" disabled={exporting || loading || !data} onClick={() => void exportRows('all')}>{inlineCopy[locale].allRecords}</button>
      </div>
    </div>
    {error ? <p className="surf-participants__error" role="alert">{inlineCopy[locale].unableToLoadOrExportParticipantsPlease}<button type="button" onClick={() => setRevision(v => v + 1)}>{inlineCopy[locale].retry}</button></p> : null}
    {loading ? <p role="status">{inlineCopy[locale].loadingParticipantRecords}</p> : null}
    {!loading && !error && data ? <>
      <div className="surf-participants__table" tabIndex={0} aria-label={inlineCopy[locale].surfRaffleParticipants}>
        <table><thead><tr>{[inlineCopy[locale].participantWallet, 'X', 'Discord', inlineCopy[locale].verification, inlineCopy[locale].tickets].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{data.rows.map(row => <tr key={row.userSub}>
            <td><strong>{row.name || '—'}</strong><span className="surf-participants__wallet">{row.walletAddress || (inlineCopy[locale].walletPending)}</span><span>{row.email || '—'}</span></td>
            <td>{row.xUsername ? <a href={`https://x.com/${encodeURIComponent(row.xUsername)}`} target="_blank" rel="noopener noreferrer">@{row.xUsername}</a> : '—'}{row.xUserId ? <small>ID {row.xUserId}</small> : null}</td>
            <td>{row.discordUsername || '—'}{row.discordUserId ? <small>ID {row.discordUserId}</small> : null}</td>
            <td><div className="surf-participants__checks">{(['accounts', 'x', 'discord'] as const).map(id => <TaskCheck key={id} task={row.tasks[id]} label={id === 'accounts' ? (inlineCopy[locale].accounts) : id === 'x' ? 'X' : 'Discord'} />)}</div><details><summary>{inlineCopy[locale].viewTimestamps}</summary>{(['accounts', 'x', 'discord'] as const).map(id => <p key={id}>{id === 'accounts' ? (inlineCopy[locale].accounts2) : id}: {row.tasks[id].verifiedAt ? date(row.tasks[id].verifiedAt!) : '—'}{row.tasks[id].outcome === 'unavailable' || row.tasks[id].outcome === 'reauthorize' ? <span>{inlineCopy[locale].latestRecheckIncomplete}</span> : null}</p>)}<p>{inlineCopy[locale].updated} {date(row.updatedAt)}</p></details></td>
            <td><strong className="surf-participants__ticket-count">{row.ticketCount}</strong>{row.status !== 'eligible' ? <small>{participantStatus(row, locale)}</small> : null}</td>
          </tr>)}</tbody>
        </table>
        {!data.rows.length ? <p className="surf-participants__empty">{inlineCopy[locale].noMatchingParticipantRecords}</p> : null}
      </div>
      <div className="surf-participants__footer"><span>{inlineCopy[locale].recordCount(data.total)}</span><div><button type="button" disabled={page === 1} onClick={() => setPage(v => v - 1)}>{inlineCopy[locale].previous}</button><span>{page} / {Math.max(1, Math.ceil(data.total / data.pageSize))}</span><button type="button" disabled={page * data.pageSize >= data.total} onClick={() => setPage(v => v + 1)}>{inlineCopy[locale].next}</button></div></div>
      {data.latestExport ? <p className="surf-participants__saved">{inlineCopy[locale].lastExport} {date(data.latestExport.createdAt)} · {data.latestExport.participants} {inlineCopy[locale].participants2} · {data.latestExport.tickets} {inlineCopy[locale].tickets2}</p> : null}
    </> : null}
    <p className="surf-participants__note">{inlineCopy[locale].raffleExportsIncludeOnlyParticipantsWithTickets}</p>
  </div>;
}

function TaskCheck({ task, label }: { task: RecordedMissionTask; label: string }) {
  return <span data-verified={task.verified}>{task.verified ? '✓' : '○'} {label}</span>;
}
function participantStatus(row: SurfParticipation, locale: AppLocale) {
  return row.status === 'wallet_required' ? (inlineCopy[locale].walletPending2) : row.status === 'wallet_already_registered' ? (inlineCopy[locale].duplicateWallet) : (inlineCopy[locale].accountsPending);
}

const inlineCopy = {
  "en": {
    recordCount: (count: number) => `${count} records`,
    participants: "Participants",
    withTickets: "With tickets",
    totalTickets: "Total tickets",
    searchParticipants: "Search participants",
    nameWalletXOrEmail: "Name, wallet, X or email",
    search: "Search",
    exporting: "Exporting…",
    exportRaffleEntries: "Export raffle entries",
    allRecords: "All records",
    unableToLoadOrExportParticipantsPlease: "Unable to load or export participants. Please retry.",
    retry: "Retry",
    loadingParticipantRecords: "Loading participant records…",
    surfRaffleParticipants: "Surf raffle participants",
    participantWallet: "Participant / wallet",
    verification: "Verification",
    tickets: "Tickets",
    walletPending: "Wallet pending",
    accounts: "Accounts",
    viewTimestamps: "View timestamps",
    accounts2: "Accounts",
    latestRecheckIncomplete: "Latest recheck incomplete",
    updated: "Updated",
    noMatchingParticipantRecords: "No matching participant records.",
    previous: "Previous",
    next: "Next",
    lastExport: "Last export",
    participants2: "participants",
    tickets2: "tickets",
    raffleExportsIncludeOnlyParticipantsWithTickets: "Raffle exports include only participants with tickets. Each export retains a snapshot of its participants and ticket counts.",
    walletPending2: "Wallet pending",
    duplicateWallet: "Duplicate wallet",
    accountsPending: "Accounts pending"
  },
  "zh-TW": {
    recordCount: (count: number) => `${count} 筆紀錄`,
    participants: "參加者",
    withTickets: "持票參加者",
    totalTickets: "總票數",
    searchParticipants: "搜尋參加者",
    nameWalletXOrEmail: "名字、錢包、X 或信箱",
    search: "搜尋",
    exporting: "匯出中…",
    exportRaffleEntries: "匯出抽獎名單",
    allRecords: "全部紀錄",
    unableToLoadOrExportParticipantsPlease: "無法取得或匯出名單。請重新載入。",
    retry: "重試",
    loadingParticipantRecords: "正在讀取參加紀錄…",
    surfRaffleParticipants: "Surf 抽獎參加名單",
    participantWallet: "參加者／錢包",
    verification: "驗證紀錄",
    tickets: "票數",
    walletPending: "尚未有錢包",
    accounts: "雙方帳號",
    viewTimestamps: "查看時間",
    accounts2: "帳號",
    latestRecheckIncomplete: "最近複查未完成",
    updated: "更新",
    noMatchingParticipantRecords: "尚無符合的參加紀錄。",
    previous: "上一頁",
    next: "下一頁",
    lastExport: "最近匯出",
    participants2: "人",
    tickets2: "張票",
    raffleExportsIncludeOnlyParticipantsWithTickets: "抽獎名單僅匯出有票數的參加者；每次匯出都會保留當次名單與票數快照。",
    walletPending2: "待錢包",
    duplicateWallet: "重複錢包",
    accountsPending: "待帳號驗證"
  },
  "ko": {
    recordCount: (count: number) => `기록 ${count}건`,
    participants: "참가자",
    withTickets: "응모권 보유 참가자",
    totalTickets: "총 응모권 수",
    searchParticipants: "참가자 검색",
    nameWalletXOrEmail: "이름, 지갑, X 또는 이메일",
    search: "검색",
    exporting: "내보내는 중…",
    exportRaffleEntries: "추첨 명단 내보내기",
    allRecords: "모든 기록",
    unableToLoadOrExportParticipantsPlease: "참가자 정보를 불러오거나 내보낼 수 없습니다. 다시 시도해 주세요.",
    retry: "다시 시도",
    loadingParticipantRecords: "참가자 기록을 불러오고 있습니다…",
    surfRaffleParticipants: "Surf 추첨 참가자",
    participantWallet: "참가자 / 지갑",
    verification: "인증",
    tickets: "응모권",
    walletPending: "지갑 준비 중",
    accounts: "계정",
    viewTimestamps: "인증 시간 보기",
    accounts2: "계정",
    latestRecheckIncomplete: "최근 재확인 미완료",
    updated: "업데이트",
    noMatchingParticipantRecords: "조건에 맞는 참가자 기록이 없습니다.",
    previous: "이전",
    next: "다음",
    lastExport: "최근 내보내기",
    participants2: "명",
    tickets2: "장",
    raffleExportsIncludeOnlyParticipantsWithTickets: "추첨 명단에는 응모권 보유 참가자만 포함됩니다. 내보낼 때마다 참가자와 응모권 수의 스냅샷이 보관됩니다.",
    walletPending2: "지갑 준비 중",
    duplicateWallet: "중복 지갑",
    accountsPending: "계정 인증 대기"
  }
} as const;
