import type { AppLocale } from '../../i18n/LocaleContext';
import type { ArchiveEventId } from './useHubArchiveRoute';

export function eventExperienceUrl(event: ArchiveEventId, locale: AppLocale, winners = false) {
  return '/events/' + event + '/?lang=' + encodeURIComponent(locale) + (winners ? '#winners' : '');
}
