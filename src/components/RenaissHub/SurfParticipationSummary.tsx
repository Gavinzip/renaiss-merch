import type { AppLocale } from '../../i18n/LocaleContext';
import type { SurfParticipation } from './useSurfMissions';

export function SurfParticipationSummary({ participation, locale }: {
  participation: SurfParticipation | null | undefined; locale: AppLocale;
}) {
  if (!participation) return null;
  const zh = locale === 'zh-TW';
  const wallet = participation.walletAddress;
  const notice = participation.status === 'wallet_required' ? (zh ? '請先完成 Renaiss 錢包設定，才能取得抽獎票。' : 'Set up your Renaiss wallet to receive tickets.') :
    participation.status === 'wallet_already_registered' ? (zh ? '此錢包已登記在另一個帳號，無法重複取得票數。' : 'This wallet is already registered to another account.') :
    participation.status === 'accounts_required' ? (zh ? '完成雙方帳號驗證，即可取得抽獎票。' : 'Verify both accounts to receive your tickets.') :
    (zh ? '驗證結果與票數已記錄。' : 'Your verification results and tickets are recorded.');
  return <div className="surf-participation" aria-live="polite" data-surf-reveal="2">
    <div className="surf-participation__tickets">
      <span>{zh ? '你的抽獎票' : 'Your raffle tickets'}</span>
      <strong>{participation.ticketCount}<small>{zh ? '張' : 'tickets'}</small></strong>
    </div>
    <div className="surf-participation__identity">
      <strong>{participation.name || (zh ? 'Renaiss 帳號' : 'Renaiss account')}</strong>
      {wallet ? <span title={wallet}>{wallet.slice(0, 6)}…{wallet.slice(-4)}</span> : null}
      <p>{notice}</p>
    </div>
    <time dateTime={participation.updatedAt}>{zh ? '已儲存 ' : 'Saved '}{new Intl.DateTimeFormat(locale, {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).format(new Date(participation.updatedAt))}</time>
  </div>;
}
