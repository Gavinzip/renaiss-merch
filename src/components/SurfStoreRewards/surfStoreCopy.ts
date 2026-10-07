export const surfStoreCopy = {
  'zh-TW': {
    preview: '預覽',
    dialogDescription: '為 Renaiss SBT 收藏者準備的 Surf 合作權益。',
    close: '關閉 Surf 權益',
    allocation: '限量配額',
    quantity: (amount: number, approximate: boolean) => `${approximate ? '約 ' : ''}${amount} 份`,
    threshold: 'SBT 持有門檻',
    pending: '待公布',
    unavailable: '兌換尚未開放',
    note: 'SBT 門檻為持有條件，兌換開放時間待公布。',
    site: '認識 Surf',
    benefits: {
      'mystery-box': { name: 'Surf Mystery Box', label: 'MYSTERY BOX', value: '1 年', unit: 'Surf Pro', view: '查看 Mystery Box', description: '包含一年 Surf Pro 與隨機股票代幣獎勵；完整內容以正式公告為準。' },
      'pro-month': { name: 'Surf Pro 一個月會員', label: 'PRO MEMBERSHIP', value: '1 個月', unit: 'Surf Pro', view: '查看會員權益', description: '探索 Surf Pro，一個月的 AI 研究體驗。' },
    },
  },
  en: {
    preview: 'Preview',
    dialogDescription: 'Surf partner benefits for Renaiss SBT collectors.',
    close: 'Close Surf benefits',
    allocation: 'Limited allocation',
    quantity: (amount: number, approximate: boolean) => `${approximate ? 'About ' : ''}${amount} rewards`,
    threshold: 'SBT holding requirement',
    pending: 'To be announced',
    unavailable: 'Redemption not open',
    note: 'The SBT requirement is a holding condition. Redemption dates will be announced.',
    site: 'Discover Surf',
    benefits: {
      'mystery-box': { name: 'Surf Mystery Box', label: 'MYSTERY BOX', value: '1 year', unit: 'Surf Pro', view: 'View Mystery Box', description: 'Includes one year of Surf Pro and a random stock-token reward. Final contents will be announced.' },
      'pro-month': { name: 'Surf Pro · 1 month', label: 'PRO MEMBERSHIP', value: '1 month', unit: 'Surf Pro', view: 'View membership', description: 'Explore AI research with one month of Surf Pro.' },
    },
  },
} as const;
