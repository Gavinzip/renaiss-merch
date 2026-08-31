import type { MerchAccessProductState } from '../../lib/merchAccessState';
import { getVerifiedSbtCount } from '../../lib/merchEligibility';
import {
  readLocalizedProductName,
  type AppLocale
} from '../../i18n/LocaleContext';
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
  locale: AppLocale,
  accessState?: MerchAccessProductState
): MerchProductPresentation {
  const copy = presentationCopy[locale];
  const lockedTitle = readLocalizedProductName(productId, locale);
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
      buttonLabel: copy.viewItem,
      category: copy.categories[productId],
      description: copy.eligibleDescription(
        productId,
        accessState.minimumSbtBalance
      ),
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
      buttonLabel: copy.checkAgain,
      category: copy.accessNotMet,
      description: copy.unqualifiedDescription(missingSbt),
      headerStatus: copy.notEligible,
      title: lockedTitle,
      visualStatus: `${verifiedSbtCount} / ${minimumSbtBalance} SBT`
    };
  }

  return {
    buttonLabel: copy.checkAccess,
    category: copy.privateDrop,
    description: copy.sealedDescription,
    headerStatus: copy.sealed,
    title: lockedTitle,
    visualStatus: copy.accessRequired
  };
}

export function readClaimStatus(
  status: MerchAccessProductState['claimStatus'],
  locale: AppLocale
) {
  const copy = presentationCopy[locale];

  switch (status) {
    case 'submitted':
      return copy.submitted;
    case 'draft':
      return copy.draftSaved;
    default:
      return copy.notStarted;
  }
}

const presentationCopy = {
  en: {
    accessNotMet: 'Access not met',
    accessRequired: 'Access required',
    categories: {
      bracelet: 'Object',
      shirt: 'Apparel',
      ticket: 'VIP access'
    },
    checkAccess: 'Check access',
    checkAgain: 'Check again',
    draftSaved: 'Draft saved',
    eligibleDescription: (productId: MerchProductId, minimum: number) =>
      `${eligibleDescriptions.en[productId]} ${minimum} SBT access requirement met.`,
    notEligible: 'Not eligible',
    notStarted: 'Not started',
    privateDrop: 'Private drop',
    sealed: 'Sealed',
    sealedDescription:
      'All release details stay sealed until your first access check.',
    submitted: 'Submitted',
    unqualifiedDescription: (missing: number) =>
      `${missing} more SBT required to reveal this release.`,
    viewItem: 'View item'
  },
  'zh-TW': {
    accessNotMet: '資格未達',
    accessRequired: '需要驗證資格',
    categories: {
      bracelet: '限量配件',
      shirt: '限量服飾',
      ticket: 'VIP 通行證'
    },
    checkAccess: '檢查資格',
    checkAgain: '重新檢查',
    draftSaved: '已儲存草稿',
    eligibleDescription: (productId: MerchProductId, minimum: number) =>
      `${eligibleDescriptions['zh-TW'][productId]} 已符合 ${minimum} SBT 的領取資格。`,
    notEligible: '不符合資格',
    notStarted: '尚未開始',
    privateDrop: '限定發行',
    sealed: '尚未解鎖',
    sealedDescription: '首次檢查資格前，所有商品資訊都會保持封存。',
    submitted: '已送出',
    unqualifiedDescription: (missing: number) =>
      `還需要 ${missing} SBT 才能解鎖此商品。`,
    viewItem: '查看商品'
  }
} as const;

const eligibleDescriptions: Record<
  AppLocale,
  Record<MerchProductId, string>
> = {
  en: {
    bracelet: 'A private Renaiss object edition with a polished finish.',
    shirt: 'A private Renaiss edition with worldwide fulfilment.',
    ticket: 'VIP event access delivered to your registered email.'
  },
  'zh-TW': {
    bracelet: 'Renaiss 限量手鍊，採用精緻拋光質感。',
    shirt: 'Renaiss 限量服飾，提供全球配送。',
    ticket: 'VIP 活動資格將寄送至你的登記信箱。'
  }
};
