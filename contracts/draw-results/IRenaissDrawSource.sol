// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IRenaissDrawSource {
    function isAdmin(address account) external view returns (bool);
    function state(bytes32 drawId) external view returns (uint8);
    function ledgerHash(bytes32 drawId) external view returns (bytes32);
    function totalTickets(bytes32 drawId) external view returns (uint256);
    function prizeSlotCount(bytes32 drawId) external view returns (uint256);
    function requestId(bytes32 drawId) external view returns (uint256);
    function randomWord(bytes32 drawId) external view returns (uint256);
    function revealedPrizeSlots(bytes32 drawId) external view returns (uint256[] memory);
}
