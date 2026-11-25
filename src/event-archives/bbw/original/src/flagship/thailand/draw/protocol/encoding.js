import { AbiCoder, keccak256, sha256, toUtf8Bytes } from "ethers";
// Retain the deployed V3 registry's protocol domain. The application/schema,
// event identity and policy are independently committed in the BBW manifest.
export const protocol = "renaiss-worlds-ticket-ecvrf-v1";
export const application = "renaiss-bbw-community-v1";
export const eventId = "renaiss-fourmeme-bbw-2026";
export const protocolHash = keccak256(toUtf8Bytes(protocol));
export const abi = AbiCoder.defaultAbiCoder();
export const hash32 = (value) => typeof value === "string" && /^0x[\da-f]{64}$/i.test(value);
export const equalHex = (a, b) => a.toLowerCase() === b.toLowerCase();
export function requireDraw(value, message) {
    if (!value)
        throw new Error(message);
}
export function canonical(value) {
    if (value === null || typeof value === "boolean" || typeof value === "string")
        return JSON.stringify(value);
    if (typeof value === "number") {
        requireDraw(Number.isSafeInteger(value), "Only safe integers can enter the draw manifest.");
        return String(value);
    }
    if (Array.isArray(value))
        return `[${value.map(canonical).join(",")}]`;
    requireDraw(value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype, "Invalid canonical value.");
    const object = value;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
}
export const digest = (value) => sha256(toUtf8Bytes(canonical(value)));
export const participantIdFor = (subject) => sha256(toUtf8Bytes(`${eventId}:${subject}`));
export const poolKey = keccak256(toUtf8Bytes(`${eventId}:community`));
export const maximumRoundNumber = 1_000_000;
export function roundIdFor(roundNumber = 1) {
    requireDraw(Number.isSafeInteger(roundNumber) && roundNumber >= 1 && roundNumber <= maximumRoundNumber, "Invalid BBW round number.");
    return keccak256(abi.encode(["bytes32", "bytes32", "bytes32", "uint256"], [
        keccak256(toUtf8Bytes("renaiss-ecvrf-round-v2")), keccak256(toUtf8Bytes(eventId)), keccak256(toUtf8Bytes("community")), roundNumber,
    ]));
}
// Historical callers and first-round proofs retain the exact original domain.
export const roundId = roundIdFor(1);
