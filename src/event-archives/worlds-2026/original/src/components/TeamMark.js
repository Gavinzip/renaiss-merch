import { jsx as _jsx, jsxs as _jsxs } from "../i18n/jsx-runtime";
export function TeamMark({ id, teams, size = "normal", }) {
    const team = teams.find((t) => t.id === id);
    return (_jsxs("div", { className: `team-mark ${size} ${!id ? "unknown" : ""}`, style: { "--team-color": team?.color || "#718178" }, "aria-label": team?.name || "戰隊待公布", children: [team?.logoUrl ? _jsx("img", { src: team.logoUrl, alt: "", "aria-hidden": "true" }) : _jsx("span", { children: id || "?" }), _jsx("i", {})] }));
}
