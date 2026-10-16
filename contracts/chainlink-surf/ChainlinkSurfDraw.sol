// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TicketRankSelection} from "../draw-results/TicketRankSelection.sol";

interface IChainlinkVrfV25Wrapper {
    function calculateRequestPriceNative(uint32 callbackGasLimit, uint32 numWords) external view returns (uint256);
    function requestRandomWordsInNative(uint32 callbackGasLimit, uint16 confirmations, uint32 numWords,
        bytes calldata extraArgs) external payable returns (uint256 requestId);
}

/// @notice One immutable Surf ledger and one Chainlink VRF v2.5 request.
/// The wrapper callback only stores the word; prize selection occurs later.
contract ChainlinkSurfDraw {
    uint256 public constant CHAIN_ID = 56;
    uint32 public constant CALLBACK_GAS_LIMIT = 200_000;
    uint16 public constant CONFIRMATIONS = 3;
    uint32 public constant NUM_WORDS = 1;
    address public constant WRAPPER = 0x471506e6ADED0b9811D05B8cAc8Db25eE839Ac94;
    bytes4 private constant EXTRA_ARGS_V1_TAG = bytes4(keccak256("VRF ExtraArgsV1"));

    address public immutable owner;
    bytes32 public immutable DRAW_ID;
    bytes32 private committedLedgerHash;
    uint256 private committedTickets;
    uint256 private committedSlots;
    uint256 private vrfRequestId;
    uint256 private vrfWord;
    uint8 private stage;
    uint256 private revealedMask;
    uint256[] private selectedTickets;
    uint256[] private revealedSlots;

    error Unauthorized();
    error WrongDraw();
    error WrongState();
    error InvalidLedger();
    error InvalidPayment();
    error InvalidSlots();

    event LedgerFinalized(bytes32 indexed drawId, bytes32 ledgerHash, uint256 totalTickets, uint256 prizeSlotCount);
    event RandomnessRequested(bytes32 indexed drawId, uint256 indexed requestId, uint256 priceWei);
    event RandomnessFulfilled(bytes32 indexed drawId, uint256 indexed requestId, uint256 randomWord);
    event PrizeRevealed(bytes32 indexed drawId, uint256 indexed slot, uint256 ticketNumber);

    constructor(bytes32 drawId) {
        if (block.chainid != CHAIN_ID || drawId == bytes32(0)) revert WrongDraw();
        owner = msg.sender;
        DRAW_ID = drawId;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyDraw(bytes32 drawId) {
        if (drawId != DRAW_ID) revert WrongDraw();
        _;
    }

    function isAdmin(address account) external view returns (bool) { return account == owner; }
    function state(bytes32 drawId) external view onlyDraw(drawId) returns (uint8) { return stage; }
    function ledgerHash(bytes32 drawId) external view onlyDraw(drawId) returns (bytes32) { return committedLedgerHash; }
    function totalTickets(bytes32 drawId) external view onlyDraw(drawId) returns (uint256) { return committedTickets; }
    function prizeSlotCount(bytes32 drawId) external view onlyDraw(drawId) returns (uint256) { return committedSlots; }
    function requestId(bytes32 drawId) external view onlyDraw(drawId) returns (uint256) { return vrfRequestId; }
    function randomWord(bytes32 drawId) external view onlyDraw(drawId) returns (uint256) { return vrfWord; }
    function revealedPrizeSlots(bytes32 drawId) external view onlyDraw(drawId) returns (uint256[] memory) { return revealedSlots; }

    function winnerTicketsBySlot(bytes32 drawId) external view onlyDraw(drawId) returns (uint256[] memory tickets) {
        tickets = new uint256[](committedSlots);
        for (uint256 i; i < committedSlots; ++i) {
            if (revealedMask & (uint256(1) << i) != 0) tickets[i] = selectedTickets[i];
        }
    }

    function roundStatus(bytes32 drawId) external view onlyDraw(drawId) returns (
        bool finalized, bool requested, bool fulfilled, uint256 totalTickets_, uint256 firstWinningTicket,
        bytes32 ledgerHash_, uint256 prizeSlotCount_, uint256 winnerCount
    ) {
        return (stage >= 1, stage >= 2, stage >= 3, committedTickets, 1, committedLedgerHash,
            committedSlots, revealedSlots.length);
    }

    function finalizeLedger(bytes32 drawId, bytes32 hash, uint256 tickets, uint256 slots, string calldata)
        external onlyOwner onlyDraw(drawId)
    {
        if (stage != 0) revert WrongState();
        if (hash == bytes32(0) || tickets == 0 || slots == 0 || slots > 256 || slots > tickets) revert InvalidLedger();
        committedLedgerHash = hash;
        committedTickets = tickets;
        committedSlots = slots;
        stage = 1;
        emit LedgerFinalized(drawId, hash, tickets, slots);
    }

    /// @dev The caller submits exactly the wrapper's price at the transaction gas price.
    /// No subscription or reusable contract balance is needed.
    function requestDraw(bytes32 drawId) external payable onlyOwner onlyDraw(drawId) returns (uint256) {
        if (stage != 1) revert WrongState();
        IChainlinkVrfV25Wrapper wrapper = IChainlinkVrfV25Wrapper(WRAPPER);
        uint256 price = wrapper.calculateRequestPriceNative(CALLBACK_GAS_LIMIT, NUM_WORDS);
        if (price == 0 || msg.value != price) revert InvalidPayment();
        bytes memory extraArgs = abi.encodeWithSelector(EXTRA_ARGS_V1_TAG, true);
        uint256 id = wrapper.requestRandomWordsInNative{value: price}(
            CALLBACK_GAS_LIMIT, CONFIRMATIONS, NUM_WORDS, extraArgs);
        vrfRequestId = id;
        stage = 2;
        emit RandomnessRequested(drawId, id, price);
        return id;
    }

    /// @dev Never select tickets or call out from this callback. Unexpected callbacks
    /// are ignored so a malicious/late wrapper message cannot alter a completed draw.
    function rawFulfillRandomWords(uint256 id, uint256[] calldata words) external {
        if (msg.sender != WRAPPER) revert Unauthorized();
        if (stage != 2 || id != vrfRequestId || words.length != 1) return;
        vrfWord = words[0];
        stage = 3;
        emit RandomnessFulfilled(DRAW_ID, id, words[0]);
    }

    function revealPrizeSlots(bytes32 drawId, uint256 expectedRequestId, bytes32 expectedLedgerHash,
        uint256[] calldata slots) external onlyOwner onlyDraw(drawId) returns (uint256[] memory tickets)
    {
        if (stage != 3 || vrfRequestId != expectedRequestId || committedLedgerHash != expectedLedgerHash)
            revert WrongState();
        if (slots.length == 0 || slots.length > committedSlots) revert InvalidSlots();
        if (selectedTickets.length == 0) selectedTickets = TicketRankSelection.select(
            vrfWord, DRAW_ID, committedTickets, committedSlots);
        tickets = new uint256[](slots.length);
        for (uint256 i; i < slots.length; ++i) {
            uint256 slot = slots[i];
            if (slot >= committedSlots || revealedMask & (uint256(1) << slot) != 0) revert InvalidSlots();
            revealedMask |= uint256(1) << slot;
            revealedSlots.push(slot);
            tickets[i] = selectedTickets[slot];
            emit PrizeRevealed(drawId, slot, tickets[i]);
        }
        if (revealedSlots.length == committedSlots) stage = 4;
    }
}
