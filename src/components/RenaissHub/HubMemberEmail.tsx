import { RENAISS_ACCOUNT_SETTINGS_URL } from '../../lib/renaissAuth';
import type { RenaissUser } from '../../lib/renaissAuth';
import type { RenaissHubCopy } from './RenaissHubCopy';

export function HubMemberEmail({ user, copy }: {
  user: Pick<RenaissUser, 'email'>;
  copy: RenaissHubCopy['member'];
}) {
  return (
    <span className="hub-member__email">
      {user.email ? <span className="hub-member__email-address">{user.email}</span> : null}
      {!user.email ? (
        <a className="hub-member__settings" href={RENAISS_ACCOUNT_SETTINGS_URL}
          target="_blank" rel="noopener noreferrer"
          title={copy.emailSettings}>
          {copy.emailMissing}
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 14 14 6M6 6h8v8" /></svg>
        </a>
      ) : null}
    </span>
  );
}
