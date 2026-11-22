import type { AppLocale } from '../i18n/LocaleContext';

type CampaignCopy = {
  description: string;
  steps: readonly [string, string, string];
  deadline: string;
};
export type FeaturedCampaign = { id: string; kind: 'surf' } | {
  id: string;
  kind: 'external';
  title: string;
  url: string;
  copy: Record<AppLocale, CampaignCopy>;
};

// Editorial selection for the permanent activity slot. Change this ID to switch
// both the homepage and navigation; the internal Surf route remains available.
export const activeCampaignId: keyof typeof hubCampaigns = 'fourmeme-bbw-2026';
export const hubCampaigns = {
  'fourmeme-bbw-2026': {
    id: 'fourmeme-bbw-2026', kind: 'external',
    title: 'Renaiss × Four.meme',
    url: 'https://renaiss-fourmeme-bbw.vercel.app/thailand/',
    copy: {
      'zh-TW': {
        description: '用你的風格，把 meme 角色變成一張異畫卡。',
        steps: ['選擇組別與 meme 角色', '創作異畫卡並分享到 X', '提交原圖與公開貼文網址'],
        deadline: '投稿截止 11/21 15:00（台北時間）',
      },
      en: {
        description: 'Turn a meme character into an alternate-art card in your own style.',
        steps: ['Choose a group and meme character', 'Create your card and share it on X', 'Submit your artwork and public post URL'],
        deadline: 'Entries close Nov 21, 15:00 (UTC+8)',
      },
      ko: {
        description: 'meme 캐릭터를 나만의 일러스트 카드로 만들어 보세요.',
        steps: ['참가 부문과 meme 캐릭터 선택', '일러스트 카드를 만들고 X에 공유', '원본과 공개 게시물 링크 제출'],
        deadline: '응모 마감 11/21 15:00 (UTC+8)',
      },
    },
  },
  surf: { id: 'surf', kind: 'surf' },
} satisfies Record<string, FeaturedCampaign>;

export function readFeaturedCampaign(): FeaturedCampaign {
  const campaign = hubCampaigns[activeCampaignId];
  if (!campaign) throw new Error(`Unknown featured campaign: ${activeCampaignId}`);
  return campaign;
}

export function campaignUrl(campaign: FeaturedCampaign, locale: AppLocale) {
  if (campaign.kind === 'surf') return '#campaign/surf';
  const url = new URL(campaign.url);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('The featured campaign requires a public HTTPS URL.');
  }
  url.searchParams.set('lang', locale);
  return url.href;
}

export const featuredCampaignCopy = {
  'zh-TW': { label: '常駐活動', details: '活動詳情', enter: '前往活動', notice: '參與資格、投稿與結果，請至正式活動網站查看。' },
  en: { label: 'Community activities', details: 'Details', enter: 'Explore the campaign', notice: 'Visit the official campaign site for eligibility, entries and results.' },
  ko: { label: '커뮤니티 활동', details: '활동 안내', enter: '활동 참여하기', notice: '참가 자격, 응모 및 결과는 공식 활동 사이트에서 확인하세요.' },
} satisfies Record<AppLocale, object>;
