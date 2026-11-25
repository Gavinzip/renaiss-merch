import { identityHash } from "./identityCommitment.js";
/*!
 * MIT License — Copyright (c) 2026 Renaiss
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { validDrawIdentity } from "./identity.js";
import { getBytes, hexlify, keccak256 } from "ethers";
import { verify } from "./vendor/verify.js";
import { abi, application, canonical, digest, equalHex, hash32, protocolHash, requireDraw } from "./encoding.js";
import { validateManifest } from "./manifest.js";
import { buildTicketTree } from "./ticketTree.js";
import { selectAccounts } from "./selection.js";
export function commitmentFor(manifest, publicKey, tree = buildTicketTree(manifest)) {
    validateManifest(manifest);
    requireDraw(hash32(publicKey), "Missing precommitted ECVRF public key.");
    return { roundId: manifest.roundId, root: tree.root, manifestHash: digest(manifest), prizePlanHash: digest(manifest.prizes),
        ticketCount: tree.count, protocolHash, publicKey };
}
export function deriveAlpha(c, chain) {
    requireDraw(hash32(chain.requestBlockHash) && Number.isSafeInteger(chain.requestBlockNumber) && chain.requestBlockNumber > 0, "Missing finalized request block.");
    return keccak256(abi.encode(["bytes32", "uint256", "address", "bytes32", "bytes32", "bytes32", "bytes32", "uint256", "bytes32", "bytes32", "uint256"], [protocolHash, chain.chainId, chain.contract, c.roundId, c.root, c.manifestHash, c.prizePlanHash, c.ticketCount, c.publicKey, chain.requestBlockHash, chain.requestBlockNumber]));
}
export function verifiedBeta(publicKey, alpha, proof) {
    requireDraw(hash32(publicKey) && hash32(alpha) && /^0x[\da-f]{160}$/i.test(proof), "Invalid ECVRF key, input or proof.");
    const beta = verify(getBytes(publicKey), getBytes(alpha), getBytes(proof));
    requireDraw(beta !== null, "ECVRF proof verification failed.");
    return hexlify(beta);
}
export function verifyBundle(bundle, authority, expectedHash) {
    requireDraw(hash32(expectedHash) && digest(bundle) === expectedHash && bundle.application === application, "BBW proof bundle hash differs.");
    requireDraw([56, 97].includes(authority.chainId) && hash32(authority.runtimeHash) && hash32(authority.publicKey), "An independently approved authority is required.");
    requireDraw(bundle.chain.chainId === authority.chainId && /^0x[\da-f]{40}$/i.test(authority.contract) &&
        equalHex(bundle.chain.contract, authority.contract) && equalHex(bundle.chain.runtimeHash, authority.runtimeHash) &&
        equalHex(bundle.chain.publicKey, authority.publicKey), "Proof authority differs from the approved event authority.");
    requireDraw(hash32(bundle.chain.commitmentTx) && hash32(bundle.chain.requestTx) &&
        Number.isSafeInteger(bundle.chain.commitmentBlockNumber) && bundle.chain.commitmentBlockNumber > 0 &&
        bundle.chain.commitmentBlockNumber < bundle.chain.requestBlockNumber, "Invalid commitment/request chronology.");
    const tree = buildTicketTree(bundle.manifest), commitment = commitmentFor(bundle.manifest, authority.publicKey, tree);
    requireDraw(canonical(commitment) === canonical(bundle.commitment), "Committed roster or prize plan differs.");
    const alpha = deriveAlpha(commitment, bundle.chain), beta = verifiedBeta(authority.publicKey, alpha, bundle.proof);
    requireDraw(alpha === bundle.alpha && beta === bundle.beta, "ECVRF alpha or beta differs.");
    const result = selectAccounts(bundle.manifest, beta, tree);
    requireDraw(canonical(result) === canonical(bundle.result) && digest(result) === bundle.resultHash, "Winner order, account exclusion or inclusion paths differ.");
    requireDraw(bundle.winners.length === result.picks.length && bundle.winners.every((winner, i) => {
        const entry = bundle.manifest.entries.find(entry => entry.participantId === result.picks[i].participantId);
        return winner.participantId === result.picks[i].participantId && validDrawIdentity(winner) && identityHash(winner) === entry?.displayNameHash;
    }), "Winner identities differ from the precommitted identities.");
    return { bundleHash: expectedHash, result, winners: bundle.winners };
}
