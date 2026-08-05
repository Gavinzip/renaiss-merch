import type { MerchAccessProductState } from '../../lib/merchAccessState';
import { getVerifiedSbtCount } from '../../lib/merchEligibility';
import type { MerchProductId } from './merchCatalog';

export type MerchProductPresentation = {
  buttonLabel: string;
  category: string;
  description: string;
  headerStatus: string | null;
  title: string;
  visualStatus: string | null;
};

export function readMerchProductPresentation(
  productId: MerchProductId,
  accessState?: MerchAccessProductState
): MerchProductPresentation {
  const lockedTitle =
    productId === 'shirt' ? 'Renaiss Tee' : 'Renaiss Bracelet';
  const verifiedSbtCount = accessState
    ? getVerifiedSbtCount(accessState)
    : null;
  const minimumSbtBalance = accessState?.minimumSbtBalance ?? null;
  const missingSbt =
    verifiedSbtCount !== null && minimumSbtBalance !== null
      ? Math.max(0, minimumSbtBalance - verifiedSbtCount)
      : null;

  if (accessState?.status === 'eligible') {
    return {
      buttonLabel: 'View item',
      category: accessState.reveal.category,
      description: `${accessState.reveal.description} ${minimumSbtBalance} SBT access requirement met.`,
      headerStatus: null,
      title: lockedTitle,
      visualStatus: null
    };
  }

  if (
    accessState?.status === 'unqualified' &&
    verifiedSbtCount !== null &&
    minimumSbtBalance !== null &&
    missingSbt !== null
  ) {
    return {
      buttonLabel: 'Check again',
      category: 'Access not met',
      description: `${missingSbt} more SBT required to reveal this release.`,
      headerStatus: 'Not eligible',
      title: lockedTitle,
      visualStatus: `${verifiedSbtCount} / ${minimumSbtBalance} SBT`
    };
  }

  return {
    buttonLabel: 'Check access',
    category: 'Private drop',
    description: 'All release details stay sealed until your first access check.',
    headerStatus: 'Sealed',
    title: lockedTitle,
    visualStatus: 'Access required'
  };
}

export function readClaimStatus(
  status: MerchAccessProductState['claimStatus']
) {
  switch (status) {
    case 'submitted':
      return 'Submitted';
    case 'draft':
      return 'Draft saved';
    default:
      return 'Not started';
  }
}
