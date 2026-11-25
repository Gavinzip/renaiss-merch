/** Official campaign cutoff: 22 Nov 2026, 17:59 Taipei time (UTC+8).
 * Announcement: https://x.com/renaissCLTB/status/2122630832628371810
 */
export const submissionWindow = {
    closesAt: "2026-11-22T09:59:00.000Z",
};
export function submissionWindowPhase(now = Date.now()) {
    if (now >= Date.parse(submissionWindow.closesAt))
        return "ended";
    return "open";
}
export function submissionWindowStatus(now = Date.now()) {
    const phase = submissionWindowPhase(now);
    return {
        ...submissionWindow,
        serverTime: new Date(now).toISOString(),
        phase,
        accepting: phase === "open",
    };
}
