import { describe, test } from "node:test";
import { deepStrictEqual } from "node:assert";
import { approvedExceptionKeys, detectClashes } from "./roster-engine";
import type { Assignment } from "./types";

const a = (over: Partial<Assignment> & { id: string; person_name: string }): Assignment => ({
  date: "2026-12-13",
  area: "Count",
  role: "",
  label: "Count 1",
  is_override: false,
  ...over,
});

describe("approved clash exceptions", () => {
  test("a date where every assignment is flagged counts as an approved exception", () => {
    const keys = approvedExceptionKeys([
      a({ id: "1", person_name: "Dean", label: "Count 1", is_override: true }),
      a({ id: "2", person_name: "Dean", label: "Hang Tight 1", area: "Hang Tight", is_override: true }),
    ]);
    deepStrictEqual([...keys], ["2026-12-13||dean"]);
  });

  test("one unflagged assignment keeps the conflict open (red)", () => {
    const keys = approvedExceptionKeys([
      a({ id: "1", person_name: "Dean", label: "Count 1", is_override: true }),
      a({ id: "2", person_name: "Dean", label: "Hang Tight 1", area: "Hang Tight" }),
    ]);
    deepStrictEqual([...keys], []);
  });

  test("a blackout conflict with a single flagged assignment counts as approved", () => {
    const keys = approvedExceptionKeys([
      a({ id: "1", person_name: "Tamara", label: "Host", area: "Host", is_override: true }),
    ]);
    deepStrictEqual([...keys], ["2026-12-13||tamara"]);
  });

  test("the clash record itself is only marked handled when every assignment is flagged", () => {
    const both = [
      a({ id: "1", person_name: "Dean", label: "Count 1", is_override: true }),
      a({ id: "2", person_name: "Dean", label: "Hang Tight 1", area: "Hang Tight" }),
    ];
    deepStrictEqual(detectClashes(both)[0].is_override, false);
    deepStrictEqual(
      detectClashes(both.map((x) => ({ ...x, is_override: true })))[0].is_override,
      true
    );
  });
});
