import { describe, test } from "node:test";
import { deepStrictEqual } from "node:assert";
import { orderAreasByPick } from "./roster-grid";

const cols = [
  { area: "Host", label: "Host" },
  { area: "Yellow Group", label: "Yellow Group — 8 1" },
  { area: "Yellow Group", label: "Yellow Group — 8 2" },
  { area: "Tea", label: "Tea 1" },
];

describe("live roster area filter", () => {
  test("several ticked areas show in the order they were picked", () => {
    deepStrictEqual(
      orderAreasByPick(cols, ["Yellow Group", "Host"]).map((c) => c.label),
      ["Yellow Group — 8 1", "Yellow Group — 8 2", "Host"],
    );
  });
  test("one ticked area keeps the sheet's column order", () => {
    deepStrictEqual(
      orderAreasByPick(cols, ["Yellow Group"]).map((c) => c.label),
      ["Host", "Yellow Group — 8 1", "Yellow Group — 8 2", "Tea 1"],
    );
  });
  test("a picked area with no columns left on the sheet is ignored, not duplicated", () => {
    deepStrictEqual(
      orderAreasByPick(cols, ["Green Group", "Host"]).map((c) => c.label),
      ["Host", "Yellow Group — 8 1", "Yellow Group — 8 2", "Tea 1"],
    );
  });
});
