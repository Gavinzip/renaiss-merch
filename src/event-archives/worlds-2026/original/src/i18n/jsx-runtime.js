import { jsx as reactJsx, jsxs as reactJsxs } from 'react/jsx-runtime';
import { localizedType } from './localized-runtime';
export { Fragment } from 'react';
export const jsx = (type, props, key) => reactJsx(localizedType(type), props, key);
export const jsxs = (type, props, key) => reactJsxs(localizedType(type), props, key);
