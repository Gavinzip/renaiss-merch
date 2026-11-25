import { jsx as _jsx, jsxs as _jsxs } from "../../../i18n/jsx-runtime";
import { useId } from 'react';
import { getProductMedia } from '../prizes/productMedia';
import { Message } from '../../../i18n/Message';
import { Unit } from '../../../i18n/Unit';
// Presentation crops measured against the existing source photographs. No generated
// packaging or retouched artwork: the SVG removes only the photographed surround.
const portraits = {
    'origins-tc': {
        viewBox: '182 89 655 619', size: 1000,
        outline: 'M193 702 L188 500 L279 439 L276 250 L334 250 L335 166 Q338 137 353 125 Q372 116 395 126 L405 115 Q418 109 433 115 Q467 91 505 94 Q552 91 590 121 L629 124 Q641 125 654 130 Q676 140 682 183 L681 250 L740 250 L738 439 L830 500 L824 702 Z',
    },
    'unleashed-cn': {
        viewBox: '244 230 730 699', size: 1200,
        outline: 'M257 922 L250 696 L357 628 L353 404 L411 404 C430 307 511 235 605 235 C704 235 781 310 804 404 L861 404 L858 628 L968 696 L961 922 Z',
    },
    'origins-en': { viewBox: '164 16 874 1136', size: 1200 },
};
export function WinnerPrizeDisplay({ prize }) {
    const clipId = useId().replaceAll(':', '');
    const product = getProductMedia(prize.productId), portrait = portraits[prize.productId];
    return _jsxs("section", { className: "winner-prize-display", "aria-label": `本輪獎品：${prize.name}`, style: { '--prize-tint': prize.color }, children: [_jsxs("div", { className: "winner-prize-display__edition", children: [_jsx("span", { children: "\u672C\u8F2A\u6B63\u53D6\u734E\u54C1" }), _jsx("span", { children: prize.language })] }), _jsxs("div", { className: "winner-prize-display__stage", children: [_jsx("div", { className: "winner-prize-display__halo", "aria-hidden": "true" }), _jsx("div", { className: "winner-prize-display__shadow", "aria-hidden": "true" }), _jsxs("svg", { className: "winner-prize-display__photo", viewBox: portrait.viewBox, role: "img", "aria-label": prize.name, children: [portrait.outline && _jsx("defs", { children: _jsx("clipPath", { id: clipId, children: _jsx("path", { d: portrait.outline }) }) }), _jsx("image", { href: product.modelImage, width: portrait.size, height: portrait.size, clipPath: portrait.outline ? `url(#${clipId})` : undefined })] })] }), _jsxs("div", { className: "winner-prize-display__copy", children: [_jsx("span", { className: "winner-prize-display__type", children: prize.type }), _jsx("h2", { children: prize.name }), _jsx("p", { children: prize.contents }), _jsxs("div", { className: "winner-prize-display__allocation", children: [_jsx("span", { children: _jsx(Message, { source: "\u672C\u8F2A\u5171 {0} {1}", values: { 0: _jsx("strong", { children: prize.slots * prize.unitsPerWinner }), 1: _jsx(Unit, { source: prize.unit, count: prize.slots * prize.unitsPerWinner }) } }) }), _jsx("span", { children: _jsx(Message, { source: "\u6BCF\u540D\u6B63\u53D6 {0} {1}", values: { 0: prize.unitsPerWinner, 1: _jsx(Unit, { source: prize.unit, count: prize.unitsPerWinner }) } }) })] })] })] });
}
