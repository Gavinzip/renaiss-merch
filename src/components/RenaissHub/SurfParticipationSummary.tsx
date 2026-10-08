import type { AppLocale } from '../../i18n/LocaleContext';
import type { SurfParticipation } from './useSurfMissions';

export function SurfParticipationSummary({ participation, locale }: {
  participation: SurfParticipation | null | undefined; locale: AppLocale;
}) {
  if (!participation) return null;
  const wallet = participation.walletAddress;
  const notice = participation.status === 'wallet_required' ? (inlineCopy[locale].setUpYourRenaissWalletToReceive) :
    participation.status === 'wallet_already_registered' ? (inlineCopy[locale].thisWalletIsAlreadyRegisteredToAnother) :
    participation.status === 'accounts_required' ? (inlineCopy[locale].verifyBothAccountsToReceiveYourTickets) :
    (inlineCopy[locale].yourVerificationResultsAndTicketsAreRecorded);
  return <div className="surf-participation" aria-live="polite" data-surf-reveal="2">
    <div className="surf-participation__tickets">
      <span>{inlineCopy[locale].yourRaffleTickets}</span>
      <strong>{participation.ticketCount}<small>{inlineCopy[locale].tickets}</small></strong>
    </div>
    <div className="surf-participation__identity">
      <strong>{participation.name || (inlineCopy[locale].renaissAccount)}</strong>
      {wallet ? <span title={wallet}>{wallet.slice(0, 6)}…{wallet.slice(-4)}</span> : null}
      <p>{notice}</p>
    </div>
    <time dateTime={participation.updatedAt}>{inlineCopy[locale].saved}{new Intl.DateTimeFormat(locale, {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).format(new Date(participation.updatedAt))}</time>
  </div>;
}

const inlineCopy = {
  "en": {
    setUpYourRenaissWalletToReceive: "Set up your Renaiss wallet to receive tickets.",
    thisWalletIsAlreadyRegisteredToAnother: "This wallet is already registered to another account.",
    verifyBothAccountsToReceiveYourTickets: "Verify both accounts to receive your tickets.",
    yourVerificationResultsAndTicketsAreRecorded: "Your verification results and tickets are recorded.",
    yourRaffleTickets: "Your raffle tickets",
    tickets: "tickets",
    renaissAccount: "Renaiss account",
    saved: "Saved "
  },
  "zh-TW": {
    setUpYourRenaissWalletToReceive: "請先完成 Renaiss 錢包設定，才能取得抽獎票。",
    thisWalletIsAlreadyRegisteredToAnother: "此錢包已登記在另一個帳號，無法重複取得票數。",
    verifyBothAccountsToReceiveYourTickets: "完成雙方帳號驗證，即可取得抽獎票。",
    yourVerificationResultsAndTicketsAreRecorded: "驗證結果與票數已記錄。",
    yourRaffleTickets: "你的抽獎票",
    tickets: "張",
    renaissAccount: "Renaiss 帳號",
    saved: "已儲存 "
  },
  "ko": {
    setUpYourRenaissWalletToReceive: "응모권을 받으려면 먼저 Renaiss 지갑을 설정하세요.",
    thisWalletIsAlreadyRegisteredToAnother: "이 지갑은 이미 다른 계정에 등록되어 있습니다.",
    verifyBothAccountsToReceiveYourTickets: "양쪽 계정 인증을 완료하면 응모권을 받을 수 있습니다.",
    yourVerificationResultsAndTicketsAreRecorded: "인증 결과와 응모권 수가 기록되었습니다.",
    yourRaffleTickets: "내 응모권",
    tickets: "장",
    renaissAccount: "Renaiss 계정",
    saved: "저장됨 "
  }
} as const;
