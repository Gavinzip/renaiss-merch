export type RosterEntry = { id: string; name: string };
export const ROSTER_LIMIT: number;
export function parseRoster(
  text: string,
  format?: "csv" | "tsv" | "txt",
): RosterEntry[];
