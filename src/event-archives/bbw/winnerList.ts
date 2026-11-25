type Award = {
  participantId: string; name: string; xUsername: string; rank: number;
  ticketNumber: number; travelLimitUsdt: number; remotePrizeUsdt: number;
};
type Source = { number: number; winners: Award[] };

// Public presentation groups people; the immutable draw records stay intact.
// The latest verified identity/card is used, with every original ticket retained.
export function createBbwWinnerList(sources: Source[]) {
  const people = new Map<string, Award & { tickets: number[] }>();
  for (const source of [...sources].sort((a, b) => b.number - a.number)) {
    for (const award of source.winners) {
      const person = people.get(award.participantId);
      if (person) person.tickets.push(award.ticketNumber);
      else people.set(award.participantId, { ...award, tickets: [award.ticketNumber] });
    }
  }
  return [...people.values()].map((person, index) => ({ ...person, displayNumber: index + 1 }));
}
