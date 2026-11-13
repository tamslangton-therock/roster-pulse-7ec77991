import { describe, test } from "node:test";
import { deepStrictEqual } from "node:assert";
import { orderAreasByPick } from "./roster-grid";

const cols = [
  { area: "Host", label: "Host" },
  { area: "Yellow Group", label: "Yellow Group — 8 1" },
  { area: "Yellow Group", label: "Yellow Group — 8 2" },
  { area: "Tea", label: "Tea 1" },
];

/** What the Live Roster does: keep only ticked areas, then order them. */
const show = (picked: string[]) =>
  orderAreasByPick(
    cols.filter((c) => picked.includes(c.area)),
    picked,
  ).map((c) => c.label);

describe("live roster area filter", () => {
  test("several ticked areas show in the order they were picked", () => {
    deepStrictEqual(show(["Yellow Group", "Host"]), [
      "Yellow Group — 8 1",
      "Yellow Group — 8 2",
      "Host",
    ]);
  });
  test("ticking Host first puts it before Yellow Group", () => {
    deepStrictEqual(show(["Host", "Yellow Group"]), [
      "Host",
      "Yellow Group — 8 1",
      "Yellow Group — 8 2",
    ]);
  });
  test("one ticked area keeps the sheet's column order", () => {
    deepStrictEqual(show(["Yellow Group"]), [
      "Yellow Group — 8 1",
      "Yellow Group — 8 2",
    ]);
  });
  test("a picked area with no columns left on the sheet is ignored, not duplicated", () => {
    deepStrictEqual(show(["Green Group", "Host"]), ["Host"]);
  });
});
