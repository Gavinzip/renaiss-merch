import { FieldDrawPage } from './FieldDrawPage';
import { isFieldDrawSitePath } from '../../../shared/site-routes.js';
import { useLocale } from '../../i18n/LocaleContext';
import { SurfDrawPage } from '../RenaissHub/SurfDrawPage';

export function DrawSiteApp() {
  const { locale } = useLocale();
  return isFieldDrawSitePath(window.location.pathname) ? <FieldDrawPage locale={locale} /> : <SurfDrawPage locale={locale} />;
}
