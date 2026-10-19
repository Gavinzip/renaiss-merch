import { surfWinnerDisplayName } from '../../shared/surf-draw-identity.js';

// This projection is used only behind the dedicated draw-room access gate.
// Contact fields are explicitly requested for the ceremony; wallets stay private.
export function publicSurfWinner(winner) {
  return {
    slot: winner.slot,
    ticketNumber: winner.ticketNumber,
    participant: {
      name: surfWinnerDisplayName(winner.participant?.name),
      walletAddress: '',
      email: winner.participant?.email || '',
      xUsername: winner.participant?.xUsername || '',
      discordUsername: winner.participant?.discordUsername || '',
      ticketRange: [0, 0]
    }
  };
}
