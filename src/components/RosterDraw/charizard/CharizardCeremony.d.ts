import type { ComponentType } from "react";
import type { RosterWinner } from "../types";
declare const CharizardCeremony: ComponentType<{
  onDraw: () => Promise<RosterWinner>;
  onClose: () => void;
  onActive: (active: boolean) => void;
  replay?: RosterWinner;
  origin: HTMLButtonElement | null;
  onPreparationError: (error: string) => void;
  onReady: (ready: boolean) => void;
}>;
export default CharizardCeremony;
