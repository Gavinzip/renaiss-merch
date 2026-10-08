import { useEffect, useId } from 'react';
import type { AppLocale } from '../../i18n/LocaleContext';
import { useModalDialog } from '../../hooks/useModalDialog';
import { missionErrorCopy } from './missionErrorCopy';
import './SurfEmailWarning.css';

// Confirmed in the official account settings UI, including the email Link action.
const RENAISS_SETTINGS_URL = 'https://www.renaiss.xyz/profile/settings';

export function SurfEmailWarning({ locale, reason, onLogin, disabled }: {
  locale: AppLocale; reason: string; onLogin: () => void; disabled: boolean;
}) {
  const titleId = useId(), descriptionId = useId();
  const dialog = useModalDialog();
  useEffect(() => { dialog.open(); }, [reason]);
  const title = inlineCopy[locale].checkYourRenaissEmail;
  return <>
    <div className="surf-email-warning__inline" role="alert">
      <p>{missionErrorCopy(reason, locale)}</p>
      <button type="button" onClick={dialog.open}>{inlineCopy[locale].howToContinue}</button>
    </div>
    <dialog ref={dialog.ref} className="surf-email-warning" data-phase={dialog.phase} role="alertdialog" aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={event => { event.preventDefault(); dialog.close(); }}
      onClick={event => { if (event.target === event.currentTarget) dialog.close(); }}>
      <div className="surf-email-warning__body">
        <button className="surf-email-warning__close" type="button" onClick={dialog.close} aria-label={inlineCopy[locale].closeReminder}>×</button>
        <span className="surf-email-warning__eyebrow">RENAISS × SURF</span>
        <h2 id={titleId} tabIndex={-1}>{title}</h2>
        <p id={descriptionId}>{inlineCopy[locale].checkThatAValidEmailIsLinked}</p>
        <div className="surf-email-warning__actions">
          <a href={RENAISS_SETTINGS_URL} target="_blank" rel="noopener noreferrer">{inlineCopy[locale].openRenaissSettings}<span aria-hidden="true">↗</span></a>
          <button type="button" disabled={disabled} onClick={onLogin}>{inlineCopy[locale].doneSignInAgain}</button>
        </div>
        <p className="surf-email-warning__note">{inlineCopy[locale].ifThisReminderRemainsAfterLinkingYour}</p>
      </div>
    </dialog>
  </>;
}

const inlineCopy = {
  "en": {
    checkYourRenaissEmail: "Check your Renaiss email",
    howToContinue: "How to continue",
    closeReminder: "Close reminder",
    checkThatAValidEmailIsLinked: "Check that a valid email is linked in Renaiss account settings, then return and sign in again to sync. Surf must use the same email to verify both accounts automatically.",
    openRenaissSettings: "Open Renaiss settings",
    doneSignInAgain: "Done — sign in again",
    ifThisReminderRemainsAfterLinkingYour: "If this reminder remains after linking your email and signing in again, Renaiss has not returned a usable email. Please contact support."
  },
  "zh-TW": {
    checkYourRenaissEmail: "先確認你的 Renaiss 信箱",
    howToContinue: "查看處理方式",
    closeReminder: "關閉提醒",
    checkThatAValidEmailIsLinked: "請到 Renaiss 帳號設定確認已綁定有效信箱，再回來重新登入同步。Surf 必須使用同一個信箱，才能自動確認雙方帳號。",
    openRenaissSettings: "前往 Renaiss 帳號設定",
    doneSignInAgain: "已完成，重新登入",
    ifThisReminderRemainsAfterLinkingYour: "若已綁定，重新登入後仍出現此提醒，代表 Renaiss 尚未回傳可用的信箱資料，請聯絡支援。"
  },
  "ko": {
    checkYourRenaissEmail: "Renaiss 이메일을 확인하세요",
    howToContinue: "해결 방법 보기",
    closeReminder: "안내 닫기",
    checkThatAValidEmailIsLinked: "Renaiss 계정 설정에서 유효한 이메일이 연결되어 있는지 확인한 후 다시 로그인해 동기화하세요. 양쪽 계정을 자동으로 확인하려면 Surf에서도 동일한 이메일을 사용해야 합니다.",
    openRenaissSettings: "Renaiss 계정 설정 열기",
    doneSignInAgain: "완료 · 다시 로그인",
    ifThisReminderRemainsAfterLinkingYour: "이메일 연결 후 다시 로그인해도 안내가 표시되면 Renaiss에서 유효한 이메일 정보를 전달하지 않은 것입니다. 지원팀에 문의해 주세요."
  }
} as const;
