import { surface, text } from "./canvasPrint";
import { foilText } from "./foilLettering";
const ink = "#283644", muted = "#d5dbde", white = "#faf8f2";
function brands(p, marks, x, y, scale = 1) {
    p.drawImage(marks.renaiss, x, y, 300 * scale, 300 / marks.renaiss.naturalWidth * marks.renaiss.naturalHeight * scale);
    text(p, "×", x + 330 * scale, y + 43 * scale, 26 * scale, muted);
    p.drawImage(marks.four, x + 380 * scale, y - 3 * scale, 210 * scale, 210 / marks.four.naturalWidth * marks.four.naturalHeight * scale);
}
function base(photo) {
    const { canvas, pen: p } = surface(1280, 800, ink);
    p.save();
    p.filter = "saturate(.72) contrast(.96) brightness(1.14)";
    // Full-bleed QSNCC photograph; preserve the recognizable facade on the right.
    const width = photo.naturalWidth / photo.naturalHeight * 800;
    p.drawImage(photo, (1280 - width) / 2, 0, width, 800);
    p.restore();
    p.fillStyle = "#28364412";
    p.fillRect(0, 0, 1280, 800);
    const veil = p.createLinearGradient(0, 0, 1280, 0);
    veil.addColorStop(0, "#283644f5");
    veil.addColorStop(.3, "#283644e8");
    veil.addColorStop(.6, "#28364480");
    veil.addColorStop(1, "#28364412");
    p.fillStyle = veil;
    p.fillRect(0, 0, 1280, 800);
    const edge = p.createLinearGradient(0, 560, 0, 800);
    edge.addColorStop(0, "#28364400");
    edge.addColorStop(1, "#283644cf");
    p.fillStyle = edge;
    p.fillRect(0, 0, 1280, 800);
    return { canvas, p };
}
export function createTravelCardPrints(c, winners, marks, photo) {
    const reverse = base(photo);
    text(reverse.p, "BBW 2026 / COMMUNITY COLLECTION", 64, 88, 20, muted, 500);
    foilText(reverse.p, "BANGKOK", 64, 250, 54);
    text(reverse.p, "QSNCC · 28—29 NOVEMBER 2026", 66, 292, 20, muted);
    brands(reverse.p, marks, 64, 390, 1.25);
    text(reverse.p, c.flip, 64, 666, 27, white, 500, 750);
    text(reverse.p, c.card, 64, 741, 18, muted);
    const faces = winners.map(winner => {
        const { canvas, p } = base(photo);
        brands(p, marks, 64, 57);
        text(p, "BANGKOK / 2026", 64, 206, 20, muted, 400);
        text(p, String(winner.rank).padStart(2, "0"), 1160, 105, 34, white);
        text(p, c.holder, 64, 292, 19, muted);
        foilText(p, winner.name, 60, 388, 62, 500, 752);
        text(p, c.upto, 66, 461, 18, muted);
        const amount = winner.travelLimitUsdt.toLocaleString("en-US");
        text(p, amount, 60, 555, 88, white, 400);
        text(p, "USDT", 64 + p.measureText(amount).width + 18, 551, 22, muted);
        text(p, c.travel, 66, 610, 25, white, 500, 730);
        text(p, `${c.remote} · ${winner.remotePrizeUsdt} USDT`, 66, 657, 22, muted, 400, 730);
        text(p, `${c.ticket} ${String(winner.ticketNumber).padStart(6, "0")}`, 64, 722, 19, muted);
        text(p, `${c.award} ${String(winner.rank).padStart(2, "0")}`, 458, 722, 19, muted);
        text(p, c.note, 64, 763, 14, muted, 400, 1144);
        return canvas;
    });
    return { reverse: reverse.canvas, faces };
}
