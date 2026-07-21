import { MerchEligibilityEntry } from './components/MerchEligibilityEntry/MerchEligibilityEntry';
import { QualifiedResult } from './components/QualifiedResult/QualifiedResult';
import type { MerchEligibilityResult } from './lib/merchEligibility';

const previewQualifiedResult: MerchEligibilityResult = {
  minimumSbtBalance: 60,
  sbtBadgeCount: 88,
  sbtBalance: 88,
  status: 'eligible',
  walletAddress: '0x1111111111111111111111111111111111111111'
};

export default function App() {
  if (
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get('preview') === 'qualified'
  ) {
    return <QualifiedResult result={previewQualifiedResult} />;
  }

  return <MerchEligibilityEntry />;
}
