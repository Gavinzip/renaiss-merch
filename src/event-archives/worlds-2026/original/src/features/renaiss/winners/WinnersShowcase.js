import { jsx as _jsx, jsxs as _jsxs } from "../../../i18n/jsx-runtime";
import { ArchiveEntry as RoomEntry } from '../../../../../../shared/ArchiveEntry';
import { WinnerPrizeDisplay } from './WinnerPrizeDisplay';
import { WinnerMatch } from './WinnerMatch';
import './winners-showcase.css';
export function WinnersShowcase({ stages, matches, prizes, teams, draws, proofLinks, activeStage }) {
    const active = stages.find(stage => stage.id === activeStage) ?? stages[0];
    const prize = prizes.find(item => item.stage === active.id);
    if (!prize)
        throw new Error(`中獎名單缺少本輪獎品：${active.id}`);
    const selectedMatches = matches.filter(match => match.stage === active.id);
    const published = selectedMatches.filter(match => draws.some(draw => draw.matchId === match.id)).length;
    return _jsx("div", { className: "winners-showcase", children: _jsxs("div", { className: "winners-showcase__layout", "data-stage": active.id, children: [_jsx(RoomEntry, { className: "winners-showcase__product", delay: .04, children: _jsx(WinnerPrizeDisplay, { prize: prize }) }), _jsxs(RoomEntry, { className: "winners-showcase__board", delay: .12, stagger: .09, children: [_jsxs("header", { className: "winner-board-head", children: [_jsxs("div", { children: [_jsxs("span", { children: ["WINNERS / ", active.en] }), _jsxs("h2", { children: [active.name, "\u4E2D\u734E\u540D\u55AE"] })] }), _jsxs("span", { className: "winner-board-head__count", children: [_jsx("strong", { children: String(published).padStart(2, '0') }), " / ", String(selectedMatches.length).padStart(2, '0'), _jsx("small", { children: "\u5834\u5DF2\u63ED\u66C9" })] })] }), published === 0 && _jsx("p", { className: "winner-board-pending", children: "\u672C\u8F2A\u9084\u6C92\u516C\u5E03\u4E2D\u734E\u540D\u55AE\uFF0C\u958B\u734E\u5F8C\u6703\u986F\u793A\u5728\u9019\u88E1\u3002" }), _jsx("div", { className: "winner-board-matches", "data-match-count": selectedMatches.length, children: selectedMatches.map(match => _jsx(WinnerMatch, { match: match, prize: prize, teams: teams, draw: draws.find(draw => draw.matchId === match.id), proofUrl: proofLinks.get(match.id) }, match.id)) })] })] }, active.id) });
}
