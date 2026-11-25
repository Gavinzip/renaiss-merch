import { concat, getBytes, hexlify } from "ethers";
import { sha512 } from "@noble/hashes/sha2.js";
import { requireDraw } from "./encoding.js";
import { drawPolicy } from "./manifest.js";
import { buildTicketTree } from "./ticketTree.js";
export function sampleBelow(bound, nextWord) {
    requireDraw(Number.isSafeInteger(bound) && bound > 0, "Invalid random bound.");
    const space = 1n << 512n, m = BigInt(bound), limit = space - space % m;
    for (;;) {
        const word = nextWord();
        requireDraw(typeof word === "bigint" && word >= 0n && word < space, "Expected uint512 randomness.");
        if (word < limit)
            return Number(word % m);
    }
}
export function selectAccounts(manifest, betaHex, tree = buildTicketTree(manifest)) {
    requireDraw(/^0x[\da-f]{128}$/i.test(betaHex), "ECVRF beta must be 64 bytes.");
    const beta = getBytes(betaHex), weights = manifest.entries.map(entry => entry.tickets), picks = [];
    let counter = 0n, remaining = tree.count;
    const word = () => {
        const bytes = getBytes(`0x${(counter++).toString(16).padStart(64, "0")}`);
        return BigInt(hexlify(sha512(getBytes(concat([beta, bytes])))));
    };
    // Weighted sampling without replacement of ACCOUNTS. The accepted word maps
    // into the remaining tickets in canonical account/within-account order.
    // Remove all tickets of the selected account before consuming another word.
    for (let rank = 0; rank < drawPolicy.winners; rank++) {
        let offset = sampleBelow(remaining, word), account = 0;
        while (offset >= weights[account]) {
            offset -= weights[account];
            account++;
        }
        const entry = manifest.entries[account], position = tree.starts[account] + offset;
        picks.push({ participantId: entry.participantId, ticketNumber: position, position, rank,
            prizeId: manifest.prizes[rank].id, path: tree.proof(position) });
        remaining -= weights[account];
        weights[account] = 0;
    }
    return { picks, wordsConsumed: counter.toString() };
}
