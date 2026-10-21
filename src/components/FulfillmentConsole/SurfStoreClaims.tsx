import { useEffect, useState } from 'react';
import { useLocale } from '../../i18n/LocaleContext';
import type { SurfClaimReceipt } from '../SurfStoreRewards/useSurfStoreClaim';
import './SurfParticipants.css';
import { surfStoreCopy } from '../SurfStoreRewards/surfStoreCopy';

type Overview = {
  inventory: { rewardId: string; claimed: number; limit: number }[];
  claims: (SurfClaimReceipt & { walletAddress: string; userSub: string; sbtBadgeCount: number })[];
};
const text = {
  'zh-TW': { title: 'Surf 商店兌換', refresh: '重新整理', loading: '讀取登記名單中…', error: '名單無法載入，請重試。', empty: '目前尚無登記。', reward: '商品／名額', account: '帳號／錢包', date: '送出時間', note: '此處是商店先到先得名額，與 Surf 活動抽獎名單分開。' },
  en: { title: 'Surf store claims', refresh: 'Refresh', loading: 'Loading claims…', error: 'Claims could not load. Please retry.', empty: 'No claims yet.', reward: 'Reward / allocation', account: 'Account / wallet', date: 'Submitted', note: 'These first-come store allocations are separate from the Surf campaign draw.' },
  ko: { title: 'Surf 스토어 신청', refresh: '새로고침', loading: '신청 내역을 불러오는 중…', error: '내역을 불러올 수 없습니다. 다시 시도해 주세요.', empty: '아직 신청 내역이 없습니다.', reward: '상품 / 수량', account: '계정 / 지갑', date: '제출 시간', note: '스토어 선착순 수량은 Surf 캠페인 추첨과 별개입니다.' },
};
export function SurfStoreClaims() {
  const { locale } = useLocale(), copy = text[locale];
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(false), [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(false);
    void (async () => {
      try {
        const response = await fetch('/api/admin/surf-store/claims', { cache: 'no-store',
          headers: { Accept: 'application/json' }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]) });
        if (!response.ok) throw new Error('surf_claims_unavailable');
        const payload = await response.json() as Overview;
        if (!controller.signal.aborted) setData(payload);
      } catch { if (!controller.signal.aborted) setError(true); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [revision]);
  const name = (id: string) => surfStoreCopy[locale].benefits[id === 'mystery-box' ? 'mystery-box' : 'pro-month'].name;
  return <section className="surf-participants" aria-label={copy.title}>
    <div className="surf-participants__tools"><p>{copy.note}</p><button type="button" onClick={() => setRevision(v => v + 1)} disabled={loading}>{copy.refresh}</button></div>
    {loading ? <p role="status">{copy.loading}</p> : null}
    {error ? <p className="surf-participants__error" role="alert">{copy.error}</p> : null}
    {!loading && !error && data ? <>
      <div className="surf-participants__metrics">{data.inventory.map(item => <div key={item.rewardId}><span>{name(item.rewardId)}</span><strong>{item.claimed} / {item.limit}</strong></div>)}</div>
      <div className="surf-participants__table" tabIndex={0} aria-label={copy.title}><table>
        <thead><tr>{[copy.reward, 'Email', copy.account, copy.date].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{data.claims.map(row => <tr key={row.id}>
          <td><strong>{name(row.rewardId)}</strong><span>#{row.allocationNumber} · {row.sbtBadgeCount} SBT</span></td>
          <td>{row.gmail}</td><td><span>{row.userSub}</span><span className="surf-participants__wallet">{row.walletAddress}</span></td>
          <td>{new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Taipei' }).format(new Date(row.submittedAt))}</td>
        </tr>)}</tbody>
      </table>{!data.claims.length ? <p className="surf-participants__empty">{copy.empty}</p> : null}</div>
    </> : null}
  </section>;
}

export const surfStoreClaimsTitle = { 'zh-TW': 'Surf 商店兌換', en: 'Surf store claims', ko: 'Surf 스토어 신청' };
export const surfStoreClaimsDescription = { 'zh-TW': '查看已保留名額的 Surf Email 登記資料。', en: 'View Surf email registrations with reserved allocations.', ko: '수량이 확보된 Surf 이메일 신청 내역을 확인하세요.' };
