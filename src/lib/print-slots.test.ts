import { describe, expect, test } from "bun:test";
import { occupiedPrintSlots } from "./print-slots";
import type { SlotDef } from "./roster-grid";

const slots: SlotDef[] = [
  { col: "B", area: "Hang Tight", role: "", label: "Hang Tight 1" },
  { col: "C", area: "Hang Tight", role: "", label: "Hang Tight 2" },
  { col: "D", area: "Host", role: "", label: "Host" },
];
const cells = {
  "2026-11-29": { "Hang Tight 2": "Dean" },
  "2026-12-06": { "Hang Tight 1": "Stefan", "Hang Tight 2": "  ", Host: "Genevieve" },
  "2027-01-03": { "Hang Tight 1": "Stefan", Host: "Genevieve" },
};

describe("printed roster columns", () => {
  test("December and January omit empty Hang Tight 2 and keep Hang Tight beside Host", () => {
    expect(occupiedPrintSlots(slots, ["2026-12-06", "2027-01-03"], cells).map((s) => s.label))
      .toEqual(["Hang Tight 1", "Host"]);
  });
  test("a column with a name on any selected date stays visible", () => {
    expect(occupiedPrintSlots(slots, ["2026-11-29", "2026-12-06"], cells).map((s) => s.label))
      .toEqual(["Hang Tight 1", "Hang Tight 2", "Host"]);
  });
});