import { communityArchiveAssetUrl } from './shared/communityArchiveAssets';
// Public campaign snapshot, checked against campaignPrizes.mjs and the published
// results of the LoL project on 2026-11-20. Alternates are not prize allocations.
export const worlds2026Archive = {
  sourceCommit: '2e7aefa76f78c7426216ad117c9e9ae23baf31f4',
  sourcePath: 'shared/campaignPrizes.mjs',
  prizeSourceCommit: 'f66c646a3da0585e771d966ad8d5713038f85139',
  mediaSourceCommit: 'e7604731a7e0d7c06a3dbb1062afcc5547e2eabe',
  website: 'https://renaiss-lol.vercel.app',
  votingOpensAt: '2026-11-02T18:00:00+08:00',
  finalVotingCutoff: '2026-11-15T02:00:00+08:00',
  media: {
    background: communityArchiveAssetUrl('worlds-2026/background.webp'),
    trophy: communityArchiveAssetUrl('worlds-2026/cup.webp'),
    wordmark: communityArchiveAssetUrl('worlds-2026/wordmark.webp'),
  },
  publicWinnerCount: 7,
  alternateCount: 0,
  partnerReward: { totalUsdt: 100, slots: 50, usdtPerSlot: 2, paymentConfirmed: false },
  prizes: [
    { stage: 'quarter', count: 4, packsPerBox: 12, names: { 'zh-TW': '繁中《起源》補充盒', en: 'Origins Booster Box · Traditional Chinese', ko: 'Origins 부스터 박스 · 번체 중국어' } },
    { stage: 'semi', count: 2, packsPerBox: 12, names: { 'zh-TW': '簡中《破限》進階盒 Jumbo', en: 'Unleashed Jumbo Booster Box · Simplified Chinese', ko: 'Unleashed Jumbo 부스터 박스 · 간체 중국어' } },
    { stage: 'final', count: 1, packsPerBox: 24, names: { 'zh-TW': '英文《起源》24 包裝補充盒', en: 'Origins Booster Display · English', ko: 'Origins 부스터 디스플레이 · 영어' } },
  ],
} as const;

export const worlds2026PrizeCount = worlds2026Archive.prizes.reduce((total, prize) => total + prize.count, 0);
