import { surfWinnerDisplayName } from '../../shared/surf-draw-identity.js';

// Publish only the confirmed winner's display name, never their fulfillment data.
export function publicSurfWinner(winner) {
  return { slot: winner.slot, ticketNumber: winner.ticketNumber,
    participant: { name: surfWinnerDisplayName(winner.participant?.name), walletAddress: '', email: '', ticketRange: [0, 0] } };
}
