import type { SlotDef } from "./roster-grid";

/** Keep a print column only when it has a name on at least one selected date. */
export function occupiedPrintSlots(
  slots: SlotDef[],
  dates: string[],
  cells: Record<string, Record<string, string>>,
): SlotDef[] {
  return slots.filter((slot) =>
    dates.some((date) => Boolean(cells[date]?.[slot.label]?.trim())),
  );
}