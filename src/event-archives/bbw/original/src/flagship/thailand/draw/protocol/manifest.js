import { submissionWindow } from "../../data/submissionWindow.js";
import { campaignRewards, communityTicketRanges } from "../../data/campaignRewards.js";
import { application, canonical, digest, eventId, hash32, protocol, requireDraw, roundIdFor } from "./encoding.js";
export const drawPolicy = Object.freeze({
    version: 1, winners: 5, alternates: 0, uniqueAccounts: true,
    selection: "sha512-counter-weighted-account-removal-v1", counterStart: 0,
});
const allowedTicketCounts = new Set(communityTicketRanges.sbt.flatMap(([, multiplier]) => communityTicketRanges.spending.map(([, base]) => base * multiplier)));
export const prizePlan = () => Array.from({ length: campaignRewards.slots.community }, (_, i) => ({
    id: `community-${i + 1}`, travelLimitUsdt: campaignRewards.travelLimit, remotePrizeUsdt: campaignRewards.remotePrize,
}));
export function validateManifest(manifest) {
    requireDraw(manifest?.protocol === protocol && manifest.application === application && manifest.eventId === eventId &&
        manifest.roundId === roundIdFor(manifest.roundNumber === undefined ? 1 : manifest.roundNumber) && manifest.cutoffAt === submissionWindow.closesAt, "Wrong BBW event, round or cutoff.");
    requireDraw(canonical(manifest.policy) === canonical(drawPolicy), "Unsupported BBW draw policy.");
    requireDraw(hash32(manifest.sourceHash) && canonical(manifest.prizes) === canonical(prizePlan()), "Source or prize commitment differs.");
    requireDraw(Array.isArray(manifest.entries) && manifest.entries.length >= drawPolicy.winners, "At least five distinct eligible accounts are required.");
    let previous = "", total = 0;
    for (const entry of manifest.entries) {
        requireDraw(hash32(entry.participantId) && entry.participantId === entry.participantId.toLowerCase() && entry.participantId > previous &&
            [entry.metricsHash, entry.submissionsHash, entry.displayNameHash].every(hash32), "Account commitments are missing, duplicated or out of order.");
        requireDraw(Number.isSafeInteger(entry.tickets) && allowedTicketCounts.has(entry.tickets), "Invalid account ticket count.");
        total += entry.tickets;
        previous = entry.participantId;
    }
    requireDraw(total <= 1_000_000, "The registry supports at most one million tickets.");
    requireDraw(new TextEncoder().encode(canonical(manifest)).length <= 30 * 1024 * 1024, "Draw manifest is too large.");
    return manifest;
}
export const manifestHash = (manifest) => digest(validateManifest(manifest));
