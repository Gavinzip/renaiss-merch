import type { AppLocale } from '../../i18n/LocaleContext';

// Display names from the Worlds prize catalog. The published manifest retains
// the original committed name, including names unknown to this presentation.
const names: Partial<Record<string, { en: string; ko: string }>> = {
  '繁中《起源》補充盒': { en: 'Origins Booster Box · Traditional Chinese', ko: '오리진 부스터 박스 · 중국어 번체판' },
  '簡中《破限》進階盒 Jumbo': { en: 'Unleashed Jumbo Booster Box · Simplified Chinese', ko: '언리쉬드 점보 부스터 박스 · 중국어 간체판' },
  '英文《起源》24 包裝補充盒': { en: 'Origins Booster Display · English · 24 packs', ko: '오리진 부스터 디스플레이 · 영어판 · 24팩' },
};

export function worldsPrizeName(name: string, locale: AppLocale) {
  return locale === 'zh-TW' ? name : names[name]?.[locale] ?? name;
}
