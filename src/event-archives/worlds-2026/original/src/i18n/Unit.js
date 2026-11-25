import { useI18n } from './I18nProvider';
const nouns = { 張: ['ticket', 'tickets'], 張票券: ['ticket', 'tickets'], 盒: ['box', 'boxes'], 場: ['match', 'matches'], 隊: ['team', 'teams'] };
/** For layouts that display the number and its unit in separate styled elements. */
export function Unit({ source, count }) {
    const { locale, text } = useI18n();
    return locale === 'en' && Object.hasOwn(nouns, source) ? nouns[source][count === 1 ? 0 : 1] : text(source);
}
