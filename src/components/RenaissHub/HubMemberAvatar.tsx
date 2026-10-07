import { useState } from 'react';
import type { RenaissHubCopy } from './RenaissHubCopy';

export function HubMemberAvatar({ picture, copy }: {
  picture: string | null; copy: RenaissHubCopy['member'];
}) {
  const [failedPicture, setFailedPicture] = useState<string | null>(null);
  const failed = Boolean(picture && failedPicture === picture);
  return <span className="hub-member__avatar" role={picture && !failed ? undefined : 'img'}
    aria-label={picture && !failed ? undefined : failed ? copy.avatarError : copy.noAvatar}
    title={failed ? copy.avatarError : picture ? undefined : copy.noAvatar}>
    {picture && !failed ? <img src={picture} alt={copy.avatar} width={48} height={48}
      referrerPolicy="no-referrer" onError={() => setFailedPicture(picture)} /> :
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" />{failed ? <path d="m18 3 3 3m0-3-3 3" /> : null}</svg>}
  </span>;
}
