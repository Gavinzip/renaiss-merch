export const campaignRewards = {
    anchor: "campaign-rewards",
    travelLimit: 1000,
    remotePrize: 300,
    slots: { community: 5, kol: 4, open: 1 },
};
const communityTicketTiers = {
    sbt: [[1, "1", 1], [2, "2–4", 2], [5, "5–9", 3], [10, "10–19", 4], [20, "20–49", 5], [50, "50–99", 6], [100, "≥ 100", 8]],
    spending: [
        [0, "> 0 – < 100", 1], [100, "100 – < 500", 2], [500, "500 – < 1,000", 4], [1000, "1,000 – < 5,000", 8],
        [5000, "5,000 – < 10,000", 16], [10000, "10,000 – < 50,000", 32], [50000, "≥ 50,000", 64],
    ],
};
export const communityTicketRanges = {
    sbt: communityTicketTiers.sbt.map(([, label, coefficient]) => [label, coefficient]),
    spending: communityTicketTiers.spending.map(([, label, coefficient]) => [label, coefficient]),
};
export function communityTicketEstimate(sbtCount, paidPackSpendUsdt) {
    const sbtMultiplier = communityTicketTiers.sbt.reduce((current, [minimum, , coefficient]) => sbtCount >= minimum ? coefficient : current, 0);
    const wholeUsdt = BigInt(paidPackSpendUsdt.split(".")[0]);
    const baseTickets = /[1-9]/.test(paidPackSpendUsdt)
        ? communityTicketTiers.spending.reduce((current, [minimum, , coefficient]) => wholeUsdt >= BigInt(minimum) ? coefficient : current, 0)
        : 0;
    return { baseTickets, sbtMultiplier, tickets: baseTickets * sbtMultiplier };
}
