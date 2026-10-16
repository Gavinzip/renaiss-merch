// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Reuses the reviewed Pokemon 30th selector. Same unused-ticket ranks
/// as RenaissLuckyDraw; never scans the complete ticket supply.
library TicketRankSelection {
    error InvalidTicketCount();

    function select(uint256 seed, bytes32 drawId, uint256 totalTickets, uint256 count)
        internal pure returns (uint256[] memory winners)
    {
        if (count == 0 || count > 256 || count > totalTickets) revert InvalidTicketCount();
        winners = new uint256[](count);
        uint256[] memory sorted = new uint256[](count);
        for (uint256 pickIndex = 0; pickIndex < count; pickIndex++) {
            uint256 target = uint256(keccak256(abi.encode(seed, drawId, pickIndex)))
                % (totalTickets - pickIndex);
            uint256 ticket = target + 1;
            for (uint256 j = 0; j < pickIndex; j++) {
                if (sorted[j] > ticket) break;
                ticket++;
            }
            winners[pickIndex] = ticket;
            uint256 insertion = pickIndex;
            while (insertion > 0 && sorted[insertion - 1] > ticket) {
                sorted[insertion] = sorted[insertion - 1];
                insertion--;
            }
            sorted[insertion] = ticket;
        }
    }
}
