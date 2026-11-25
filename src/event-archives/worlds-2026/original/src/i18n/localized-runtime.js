import { Children, Fragment, createContext, createElement, useContext } from 'react';
import { useI18n } from './I18nProvider';
import { translate, normalize, messageCatalog } from './translation';
// The JSX boundary renders the original HTML element: no extra DOM, observers or text mutations.
// A fixed HTML whitelist keeps Three.js/R3F primitives completely outside localization.
const html = new Set('svg text title desc a abbr address article aside b bdi bdo blockquote br button caption cite col colgroup code pre data datalist dd del details dfn dialog div dl dt em fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr i img input ins kbd label legend li main mark menu meter nav ol optgroup option output p picture progress q rp rt ruby s samp search section select slot small source span strong sub summary sup table tbody td template textarea tfoot th thead time tr u ul var video canvas'.split(' '));
const Suppress = createContext(false);
const nativeTags = new Map();
const visibleAttributes = ['aria-label', 'aria-description', 'aria-valuetext', 'title', 'placeholder', 'alt', 'label'];
export function localizeChildren(children, locale) {
    if (children === undefined || children === null)
        return children;
    // Normalize keys in every locale. Switching from raw Chinese children to the
    // keyed translated array would otherwise remount scene, provider and form state.
    const flat = Children.toArray(children);
    if (locale === 'zh-Hant')
        return flat;
    const values = [];
    const source = flat.map(child => {
        if (typeof child === 'string' || typeof child === 'number')
            return String(child);
        const index = values.push(child) - 1;
        return `\uE000${index}\uE001`;
    }).join('');
    // Sentinels preserve embedded icons/links/formatting while allowing language-specific word order.
    const skeleton = source.replace(/\uE000(\d+)\uE001/g, '{$1}');
    let target;
    if (values.length) {
        // Only an explicit rich-text message may move embedded controls or formatting.
        // Template matching across unknown elements could reorder a status badge or user content.
        const exact = messageCatalog[normalize(skeleton)];
        if (!exact)
            return flat.map(child => typeof child === 'string' ? translate(child, locale) : child);
        target = exact[locale === 'en' ? 0 : 1].replace(/\{(\d+)\}/g, (_, index) => `\uE000${index}\uE001`);
    }
    else
        target = translate(source, locale);
    const parts = target.split(/(\uE000\d+\uE001)/g).filter(Boolean).map(part => {
        const match = /^\uE000(\d+)\uE001$/.exec(part);
        return match ? values[Number(match[1])] : part;
    });
    return parts.length === 1 ? parts[0] : parts;
}
export function localizedType(type) {
    if (type === Fragment)
        return LocalizedFragment;
    if (typeof type !== 'string' || !html.has(type))
        return type;
    let wrapped = nativeTags.get(type);
    if (wrapped)
        return wrapped;
    const tag = type;
    wrapped = function LocalizedHTML(props) {
        const { locale } = useI18n();
        const inherited = useContext(Suppress);
        const suppressSubtree = props.translate === 'no' || tag === 'pre' || tag === 'code';
        const suppressed = inherited || suppressSubtree;
        const native = { ...props };
        if (!suppressed) {
            for (const key of visibleAttributes)
                if (typeof native[key] === 'string')
                    native[key] = translate(native[key], locale);
            if (props.children !== undefined && !['input', 'textarea', 'canvas', 'video'].includes(tag))
                native.children = localizeChildren(props.children, locale);
            // An option without a value uses its source label as the submitted value. Preserve that contract.
            if (tag === 'option' && props.value === undefined && typeof props.children === 'string')
                native.value = props.children;
        }
        const element = createElement(tag, native);
        return suppressSubtree ? createElement(Suppress.Provider, { value: true }, element) : element;
    };
    nativeTags.set(tag, wrapped);
    return wrapped;
}
function LocalizedFragment({ children }) {
    const { locale } = useI18n();
    const suppressed = useContext(Suppress);
    return createElement(Fragment, null, suppressed ? children : localizeChildren(children, locale));
}
