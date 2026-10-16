import { useLocale } from '../../i18n/LocaleContext';
import { SurfDrawPage } from '../RenaissHub/SurfDrawPage';

export function DrawSiteApp() {
  const { locale } = useLocale();
  return <SurfDrawPage locale={locale} />;
}
