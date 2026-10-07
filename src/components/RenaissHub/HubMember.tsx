import { RENAISS_ACCOUNT_SETTINGS_URL } from '../../lib/renaissAuth';
import { HubLogo } from './HubLogo';
import { HubMemberAvatar } from './HubMemberAvatar';
import { HubMemberEmail } from './HubMemberEmail';
import { HubWalletCopy } from './HubWalletCopy';
import { HubMotionText } from './HubMotionText';
import { useMemberSbt } from './useMemberSbt';
import type { AccountState } from './RenaissHubFeatures';
import type { RenaissHubCopy } from './RenaissHubCopy';
import './HubMember.css';

export function HubMember({ account, copy, onLogin, onRetry, preview = false }: {
  account: AccountState; copy: RenaissHubCopy['member'];
  onLogin: () => void; onRetry: () => void; preview?: boolean;
}) {
  const user = account.status === 'ready' && account.session.authenticated ? account.session.user : null;
  const { state: sbt, retry: retrySbt } = useMemberSbt(user, preview);
  const displayName = user ? user.name || user.twitterUsername || copy.accountLabel : copy.disconnected;
  const message = account.status === 'loading' ? copy.loading : account.status === 'error' ? copy.error :
    user ? copy.accountLabel : copy.description;
  const needsSync = user && (!user.email || !user.twitterUsername);
  const sbtMessage = sbt.status === 'error' ? copy.sbtError : sbt.status === 'wallet-pending' ? copy.missingWallet :
    sbt.status === 'preview' ? copy.sbtPreview : sbt.status === 'demo' ? copy.sbtDemo : copy.sbtLoading;

  return <article className={`renaiss-hub__card renaiss-hub__member hub-member ${user ? 'is-authenticated' : ''}`}
    id={preview ? undefined : 'portal-member'}>
    <div className="renaiss-hub__card-heading">
      <h2><HubMotionText>{copy.title}</HubMotionText></h2>
      {user ? <span className="renaiss-hub__status"><i />{copy.connected}</span> :
        <span className="renaiss-hub__eyebrow">{copy.eyebrow}</span>}
    </div>
    <div className="renaiss-hub__identity">
      {user ? <HubMemberAvatar picture={user.picture} copy={copy} /> :
        <span className="renaiss-hub__identity-mark"><HubLogo /></span>}
      <div><strong title={displayName}>{displayName}</strong><p role={account.status === 'error' ? 'alert' : 'status'}>{message}</p></div>
    </div>
    {user ? <div className="hub-member__sbt" aria-live="polite" aria-busy={sbt.status === 'loading'}>
      {sbt.status === 'ready' ? <><strong className="hub-member__sbt-count" key={sbt.count}>{sbt.count.toLocaleString()}</strong><span>{copy.sbt}</span></> :
        <><div className="hub-member__sbt-pending"><span className="hub-member__sbt-label">{copy.sbt}</span><span>{sbtMessage}</span></div>
          {sbt.status === 'error' ? <button type="button" className="hub-member__retry" onClick={retrySbt}>{copy.retry}<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 7a6 6 0 1 0 0 6M16 3v4h-4" /></svg></button> : null}</>}
    </div> : null}
    <dl className="renaiss-hub__account-details">
      <div><dt>{copy.wallet}</dt><dd>{user?.safeWalletAddress ? <HubWalletCopy key={user.safeWalletAddress} address={user.safeWalletAddress} copy={copy} /> : user ? copy.missingWallet : copy.unavailable}</dd></div>
      {user ? <div><dt>{copy.email}</dt><dd className="hub-member__email-detail"><HubMemberEmail user={user} copy={copy} /></dd></div> : null}
      <div><dt>{copy.x}</dt><dd>{user?.twitterUsername ? <a className="hub-member__settings is-linked" href={`https://x.com/${encodeURIComponent(user.twitterUsername.replace(/^@/, ''))}`} target="_blank" rel="noopener noreferrer">@{user.twitterUsername.replace(/^@/, '')}<ExternalArrow /></a> : user ?
        <a className="hub-member__settings" href={RENAISS_ACCOUNT_SETTINGS_URL} target="_blank" rel="noopener noreferrer" title={copy.xSettings}>{copy.missingX}<ExternalArrow /></a> : copy.unavailable}</dd></div>
    </dl>
    {needsSync ? <div className="hub-member__sync"><span>{copy.syncHint}</span><button type="button" onClick={onLogin}>{copy.syncAccount}<ExternalArrow /></button></div> : null}
    {!user && account.status !== 'loading' ? <button className="renaiss-hub__button renaiss-hub__account-action t-learn" onClick={account.status === 'error' ? onRetry : onLogin} type="button">
      <span className="hub-action-label">{account.status === 'error' ? copy.retry : copy.login}</span><span className="t-learn-chevron" aria-hidden="true"><svg className="renaiss-hub__arrow" viewBox="0 0 16 16"><path className="t-learn-arm t-learn-arm-top" d="M6 4L10 8" /><path className="t-learn-arm t-learn-arm-bot" d="M10 8L6 12" /></svg></span>
    </button> : null}
  </article>;
}

function ExternalArrow() { return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 14 14 6M6 6h8v8" /></svg>; }
