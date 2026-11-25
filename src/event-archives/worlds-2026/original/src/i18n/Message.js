import { Fragment, createElement } from 'react';
import { useI18n } from './I18nProvider';
/** Explicit rich messages for sentences mixing dynamic values with emphasis or links. */
export function Message({ source, values }) {
    const { text } = useI18n();
    const pieces = text(source).split(/(\{\w+\})/g).filter(Boolean).map((part, index) => {
        const slot = /^\{(\w+)\}$/.exec(part);
        return slot ? createElement(Fragment, { key: index }, values[slot[1]] ?? part) : part;
    });
    return createElement(Fragment, null, pieces);
}
