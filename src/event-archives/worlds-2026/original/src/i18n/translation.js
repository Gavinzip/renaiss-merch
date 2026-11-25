import catalog from './catalog.json';
export const locales = [
    { id: 'zh-Hant', name: '繁體中文', intl: 'zh-TW' },
    { id: 'en', name: 'English', intl: 'en-US' },
    { id: 'ko', name: '한국어', intl: 'ko-KR' },
];
export const normalize = (text) => text.replace(/\s+/g, ' ').trim();
const messages = catalog;
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patterns = Object.entries(messages).filter(([key]) => /\{\w+\}/.test(key)).map(([key, targets]) => {
    const slots = [];
    const parts = key.split(/(\{\w+\})/g).map(part => {
        if (/^\{\w+\}$/.test(part)) {
            slots.push(part);
            return '(.+?)';
        }
        return escapeRegex(part).replace(/ /g, '\\s*');
    });
    return { key, targets, slots, regex: new RegExp(`^${parts.join('')}$`), weight: key.replace(/\{\w+\}/g, '').length };
}).sort((a, b) => b.weight - a.weight);
const cache = { en: new Map(), ko: new Map() };
/** Translates presentation strings only. Canonical API records, form values and proof inputs stay untouched. */
export function translate(text, locale) {
    if (locale === 'zh-Hant' || !text || !/[\p{Script=Han}]/u.test(text))
        return text;
    const cached = cache[locale].get(text);
    if (cached !== undefined)
        return cached;
    const key = normalize(text), index = locale === 'en' ? 0 : 1;
    let result = messages[key]?.[index];
    if (result === undefined) {
        for (const pattern of patterns) {
            const match = pattern.regex.exec(key);
            if (!match)
                continue;
            // Do not mistake an unrelated paragraph for a template with a short literal.
            const resolved = match.slice(1).map(value => translate(value, locale));
            if (resolved.some(value => /[\p{Script=Han}]/u.test(value)))
                continue;
            const values = new Map(pattern.slots.map((slot, i) => [slot, resolved[i]]));
            result = pattern.targets[index].replace(/\{\w+\}/g, slot => values.get(slot) ?? slot);
            break;
        }
    }
    // Unknown external values (names, IDs, third-party errors) remain the original source.
    result = result === undefined ? text : `${/^\s/.test(text) ? ' ' : ''}${result}${/\s$/.test(text) ? ' ' : ''}`;
    if (cache[locale].size > 10000)
        cache[locale].clear();
    if (locale === 'en')
        result = result.replace(/\b1 (tickets|boxes|matches|teams|votes|recipients|draws|packs|cards)\b/g, (_, unit) => '1 ' + ({ boxes: 'box', matches: 'match' }[unit] ?? unit.slice(0, -1)));
    cache[locale].set(text, result);
    return result;
}
export function formatMessage(source, locale, values = {}) {
    return translate(source, locale).replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? `{${key}}`));
}
export function intlLocale(locale) { return locales.find(item => item.id === locale).intl; }
export const messageCatalog = messages;
