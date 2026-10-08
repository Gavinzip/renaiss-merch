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
      return copy.startClaim;
  }
}

const presentationCopy = {
  ko: {
    accessNotMet: "자격 미충족",
    accessRequired: "자격 인증 필요",
    categories: {
      bracelet: "한정 액세서리",
      shirt: "의류",
      ticket: "VIP 입장"
    },
    checkAccess: "자격 확인",
    checkAgain: "다시 확인",
    draftSaved: "임시 저장 완료",
    eligibleDescription: (productId: MerchProductId, minimum: number) =>
      `${eligibleDescriptions.ko[productId]} ${minimum} SBT 수령 조건을 충족했습니다.`,
    notEligible: "자격 미충족",
    privateDrop: "한정 발매",
    sealed: "미공개",
    sealedDescription:
      "첫 자격 확인 전에는 모든 상품 정보가 봉인된 상태로 유지됩니다.",
    startClaim: "수령 신청",
    submitted: "제출 완료",
    unqualifiedDescription: (missing: number) =>
      `상품을 공개하려면 SBT ${missing}개가 더 필요합니다.`,
    viewItem: "상품 보기"
  },
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
    privateDrop: 'Private drop',
    sealed: 'Sealed',
    sealedDescription:
      'All release details stay sealed until your first access check.',
    startClaim: 'Start to Claim',
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
    privateDrop: '限定發行',
    sealed: '尚未解鎖',
    sealedDescription: '首次檢查資格前，所有商品資訊都會保持封存。',
    startClaim: '開始領取',
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
  ko: {
    bracelet: "정교한 광택이 돋보이는 Renaiss 한정 팔찌.",
    shirt: "전 세계 배송이 가능한 Renaiss 한정 의류.",
    ticket: "등록된 이메일로 VIP 행사 입장 자격이 전달됩니다."
  },
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
