import { useEffect, useState } from 'react';
import { useLocale } from '../../i18n/LocaleContext';
import { readRenaissSession, startRenaissLogin } from '../../lib/renaissAuth';
import type { AccountState } from '../RenaissHub/RenaissHubFeatures';
import { SurfDrawPage } from '../RenaissHub/SurfDrawPage';

// The dedicated entry mounts only the draw UI. The Renaiss session is needed
// solely for the existing on-chain administrator check.
export function DrawSiteApp() {
  const { locale } = useLocale();
  const [account, setAccount] = useState<AccountState>({ status: 'loading' });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setAccount({ status: 'loading' });
    void readRenaissSession().then(session => {
      if (!cancelled) setAccount({ status: 'ready', session });
    }).catch(() => { if (!cancelled) setAccount({ status: 'error' }); });
    return () => { cancelled = true; };
  }, [revision]);

  return <SurfDrawPage locale={locale} account={account}
    onLogin={() => startRenaissLogin()} onRetry={() => setRevision(value => value + 1)} />;
}
