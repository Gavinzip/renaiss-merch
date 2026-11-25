import { concat, getBytes, hexlify, keccak256 } from "ethers";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { abi, equalHex, hash32, poolKey, protocolHash, requireDraw } from "./encoding.js";
import { validateManifest } from "./manifest.js";
export function ticketLeaf(ticket, round) {
    return keccak256(abi.encode(["bytes32", "bytes32", "bytes32", "uint256", "uint256", "bytes32"], [protocolHash, round, poolKey, ticket.position, ticket.ticketNumber, ticket.participantId]));
}
export function verifyInclusion(ticket, path, root, round) {
    return Array.isArray(path) && path.length <= 32 && path.every(hash32) && equalHex(path.reduce((node, sibling) => keccak256(concat(BigInt(node) < BigInt(sibling) ? [node, sibling] : [sibling, node])), ticketLeaf(ticket, round)), root);
}
// Same complete-tree layout and sorted child hashing as Worlds. Build once;
// retain only nodes and account ranges, rather than a million ticket objects.
export function buildTicketTree(manifest) {
    validateManifest(manifest);
    const count = manifest.entries.reduce((n, entry) => n + entry.tickets, 0);
    const nodes = new Array(2 * count - 1), starts = [];
    const encoded = new Uint8Array(192), view = new DataView(encoded.buffer);
    encoded.set(getBytes(protocolHash));
    encoded.set(getBytes(manifest.roundId), 32);
    encoded.set(getBytes(poolKey), 64);
    let position = 0;
    for (const entry of manifest.entries) {
        starts.push(position + 1);
        encoded.set(getBytes(entry.participantId), 160);
        for (let n = 0; n < entry.tickets; n++) {
            position++;
            view.setUint32(124, position, false);
            view.setUint32(156, position, false);
            nodes[nodes.length - position] = keccak_256(encoded);
        }
    }
    for (let i = count - 2; i >= 0; i--) {
        const a = nodes[2 * i + 1], b = nodes[2 * i + 2], bytes = new Uint8Array(64);
        let order = 0;
        for (let j = 0; j < 32 && order === 0; j++)
            order = a[j] - b[j];
        bytes.set(order < 0 ? a : b);
        bytes.set(order < 0 ? b : a, 32);
        nodes[i] = keccak_256(bytes);
    }
    return { root: hexlify(nodes[0]), count, starts, proof(position) {
            requireDraw(Number.isSafeInteger(position) && position >= 1 && position <= count, "Ticket is absent from the committed tree.");
            let index = nodes.length - position;
            const path = [];
            while (index > 0) {
                path.push(hexlify(nodes[index % 2 === 0 ? index - 1 : index + 1]));
                index = Math.floor((index - 1) / 2);
            }
            return path;
        } };
}
