import { test } from "node:test";
import { strictEqual } from "node:assert";
import { canEditSlotLabel, recordFromTabValues, toSessionUser } from "./user-access";
import type { SlotDef } from "./roster-grid";

const oly = toSessionUser(recordFromTabValues({
  username: "Oly",
  password: "",
  display_name: "Oly",
  roster_view_areas: [],
  roster_edit_areas: ["Yellow Group", "Green Group", "Teens"],
  can_view_health: true,
  team_edit_areas: [],
  individuals_access: "view",
  can_view_roster: true,
  can_view_life_groups: false,
  health_view_areas: [],
  individuals_view_areas: [],
}));
const slots: SlotDef[] = [
  { col: "A", area: "Teens", role: "", label: "Teens 1" },
  { col: "B", area: "Host", role: "", label: "Host" },
];

test("Oly can edit a Teens assignment when resolving a clash", () => {
  strictEqual(canEditSlotLabel(false, oly, "Teens 1", slots), true);
});

test("Oly cannot edit the Host side of a cross-area clash", () => {
  strictEqual(canEditSlotLabel(false, oly, "Host", slots), false);
});