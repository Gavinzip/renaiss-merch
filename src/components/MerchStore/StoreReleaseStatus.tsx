import { useLocale } from '../../i18n/LocaleContext';
import './StoreReleaseStatus.css';

// Shared by physical merchandise and partner rewards after the allocation ends.
export function StoreReleaseStatus() {
  const { locale } = useLocale();
  const label = { 'zh-TW': '已全數領取', en: 'Fully claimed', ko: '수령 마감' }[locale];
  return <span className="store-release-status" role="status">{label}</span>;
}
