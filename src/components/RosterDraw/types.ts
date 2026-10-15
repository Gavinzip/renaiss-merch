import type { RosterEntry } from "../../../shared/roster-draw.js";
export type RosterKind = "charizard" | "other";
export type RosterWinner = {
  sequence: number;
  requestId: string;
  entryId: string;
  name: string;
  kind: RosterKind;
  prize: string;
  drawnAt: string;
};
export type RosterState = {
  roster: {
    id: string;
    title: string;
    hash: string;
    entries: RosterEntry[];
    createdAt: string;
  } | null;
  winners: RosterWinner[];
  history: RosterWinner[];
};
