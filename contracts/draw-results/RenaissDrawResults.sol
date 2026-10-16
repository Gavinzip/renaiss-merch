// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IRenaissDrawSource} from "./IRenaissDrawSource.sol";
import {TicketRankSelection} from "./TicketRankSelection.sol";

/// @notice Shared result publication for canonical Renaiss draws. The source
/// still commits each ledger and requests VRF. Every request has independent,
/// permanent results; resetting the source cannot reuse an old result set.
contract RenaissDrawResults {
    uint256 public constant CHAIN_ID = 56;
    address public constant SOURCE = 0x78b79dB5726700BeDb18BC05aA612b11E33B00A9;
    bytes32 public constant SOURCE_CODE_HASH = 0xcae9a3ae4f2c228b4fba26e00e4a9d3b79b357e3ac295f2b7139ff76d3013261;

    struct Results {
        bytes32 drawId;
        bytes32 ledgerHash;
        uint256 requestId;
        uint256 randomWord;
        uint256 totalTickets;
        uint256 prizeSlotCount;
        uint256 snapshotBlock;
        uint256 revealedMask;
        uint256[] tickets;
        uint256[] slots;
    }
    mapping(bytes32 => Results) private results;

    error WrongSource();
    error Unauthorized();
    error SourceChanged();
    error InvalidPrizeSlots();

    event ResultsBound(bytes32 indexed resultId, bytes32 indexed drawId, bytes32 ledgerHash,
        uint256 requestId, uint256 randomWord, uint256 totalTickets, uint256 prizeSlotCount);
    event PrizeRevealed(bytes32 indexed resultId, bytes32 indexed drawId, uint256 indexed slot, uint256 ticketNumber);
    event ResultsCompleted(bytes32 indexed resultId, bytes32 indexed drawId);

    constructor() { _checkRuntime(); }

    modifier onlyAdmin() {
        _checkRuntime();
        if (!IRenaissDrawSource(SOURCE).isAdmin(msg.sender)) revert Unauthorized();
        _;
    }

    function resultIdFor(bytes32 drawId, bytes32 ledgerHash, uint256 requestId) public pure returns (bytes32) {
        return keccak256(abi.encode(CHAIN_ID, SOURCE, SOURCE_CODE_HASH, drawId, ledgerHash, requestId));
    }

    function revealPrizeSlots(bytes32 drawId, uint256 expectedRequestId, bytes32 expectedLedgerHash,
        uint256[] calldata prizeSlots) external onlyAdmin returns (uint256[] memory tickets)
    {
        IRenaissDrawSource source = IRenaissDrawSource(SOURCE);
        if (drawId == bytes32(0) || expectedRequestId == 0 || expectedLedgerHash == bytes32(0)
            || source.state(drawId) != 3 || source.requestId(drawId) != expectedRequestId
            || source.ledgerHash(drawId) != expectedLedgerHash || source.revealedPrizeSlots(drawId).length != 0)
            revert SourceChanged();

        uint256 totalTickets = source.totalTickets(drawId);
        uint256 count = source.prizeSlotCount(drawId);
        uint256 seed = source.randomWord(drawId);
        if (count == 0 || count > 256 || count > totalTickets || prizeSlots.length == 0 || prizeSlots.length > count)
            revert InvalidPrizeSlots();
        bytes32 resultId = resultIdFor(drawId, expectedLedgerHash, expectedRequestId);
        Results storage r = results[resultId];
        if (r.snapshotBlock == 0) {
            r.drawId = drawId; r.ledgerHash = expectedLedgerHash; r.requestId = expectedRequestId;
            r.randomWord = seed; r.totalTickets = totalTickets; r.prizeSlotCount = count; r.snapshotBlock = block.number;
            r.tickets = TicketRankSelection.select(seed, drawId, totalTickets, count);
            emit ResultsBound(resultId, drawId, expectedLedgerHash, expectedRequestId, seed, totalTickets, count);
        } else if (r.randomWord != seed || r.totalTickets != totalTickets || r.prizeSlotCount != count) {
            revert SourceChanged();
        }

        tickets = new uint256[](prizeSlots.length);
        for (uint256 i; i < prizeSlots.length; i++) {
            uint256 slot = prizeSlots[i];
            if (slot >= count || r.revealedMask & (uint256(1) << slot) != 0) revert InvalidPrizeSlots();
            r.revealedMask |= uint256(1) << slot;
            r.slots.push(slot);
            tickets[i] = r.tickets[slot];
            emit PrizeRevealed(resultId, drawId, slot, tickets[i]);
        }
        if (r.slots.length == count) emit ResultsCompleted(resultId, drawId);
    }

    function resultStatus(bytes32 resultId) external view returns (bool bound, bytes32 drawId,
        bytes32 ledgerHash, uint256 requestId, uint256 randomWord, uint256 totalTickets,
        uint256 prizeSlotCount, uint256 snapshotBlock, uint256 revealedCount)
    {
        Results storage r = results[resultId];
        return (r.snapshotBlock != 0, r.drawId, r.ledgerHash, r.requestId, r.randomWord,
            r.totalTickets, r.prizeSlotCount, r.snapshotBlock, r.slots.length);
    }

    function winnerTicketsBySlot(bytes32 resultId) external view returns (uint256[] memory tickets) {
        Results storage r = results[resultId];
        tickets = new uint256[](r.prizeSlotCount);
        for (uint256 i; i < r.prizeSlotCount; i++) {
            if (r.revealedMask & (uint256(1) << i) != 0) tickets[i] = r.tickets[i];
        }
    }

    function revealedPrizeSlots(bytes32 resultId) external view returns (uint256[] memory) {
        return results[resultId].slots;
    }

    function _checkRuntime() private view {
        if (block.chainid != CHAIN_ID || SOURCE.codehash != SOURCE_CODE_HASH) revert WrongSource();
    }
}
