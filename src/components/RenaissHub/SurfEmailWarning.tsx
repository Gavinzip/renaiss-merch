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
  const zh = locale === 'zh-TW', titleId = useId(), descriptionId = useId();
  const dialog = useModalDialog();
  useEffect(() => { dialog.open(); }, [reason]);
  const title = zh ? '先確認你的 Renaiss 信箱' : 'Check your Renaiss email';
  return <>
    <div className="surf-email-warning__inline" role="alert">
      <p>{missionErrorCopy(reason, zh)}</p>
      <button type="button" onClick={dialog.open}>{zh ? '查看處理方式' : 'How to continue'}</button>
    </div>
    <dialog ref={dialog.ref} className="surf-email-warning" data-phase={dialog.phase} role="alertdialog" aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={event => { event.preventDefault(); dialog.close(); }}
      onClick={event => { if (event.target === event.currentTarget) dialog.close(); }}>
      <div className="surf-email-warning__body">
        <button className="surf-email-warning__close" type="button" onClick={dialog.close} aria-label={zh ? '關閉提醒' : 'Close reminder'}>×</button>
        <span className="surf-email-warning__eyebrow">RENAISS × SURF</span>
        <h2 id={titleId} tabIndex={-1}>{title}</h2>
        <p id={descriptionId}>{zh ? '請到 Renaiss 帳號設定確認已綁定有效信箱，再回來重新登入同步。Surf 必須使用同一個信箱，才能自動確認雙方帳號。' : 'Check that a valid email is linked in Renaiss account settings, then return and sign in again to sync. Surf must use the same email to verify both accounts automatically.'}</p>
        <div className="surf-email-warning__actions">
          <a href={RENAISS_SETTINGS_URL} target="_blank" rel="noopener noreferrer">{zh ? '前往 Renaiss 帳號設定' : 'Open Renaiss settings'}<span aria-hidden="true">↗</span></a>
          <button type="button" disabled={disabled} onClick={onLogin}>{zh ? '已完成，重新登入' : 'Done — sign in again'}</button>
        </div>
        <p className="surf-email-warning__note">{zh ? '若已綁定，重新登入後仍出現此提醒，代表 Renaiss 尚未回傳可用的信箱資料，請聯絡支援。' : 'If this reminder remains after linking your email and signing in again, Renaiss has not returned a usable email. Please contact support.'}</p>
      </div>
    </dialog>
  </>;
}
