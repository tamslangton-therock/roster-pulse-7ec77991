import { test } from "node:test";
import { deepStrictEqual, strictEqual } from "node:assert";
import { builderAreas, builderTeamName, sourceAreas } from "./team-builder-groups";

test("Hang Tight and Host share one builder area with both original storage areas", () => {
  deepStrictEqual(builderAreas(["Count", "Hang Tight", "Host", "Hosting"]), ["Count", "Hang Tight & Host", "Hosting"]);
  deepStrictEqual(sourceAreas("Hang Tight & Host"), ["Hang Tight", "Host"]);
});
test("existing numbered teams align without dropping differently named teams", () => {
  strictEqual(builderTeamName("Hang Tight", "Hang Tight Team 1"), "Team 1");
  strictEqual(builderTeamName("Host", "Host Team 1"), "Team 1");
  strictEqual(builderTeamName("Host", "Evening crew"), "Evening crew");
});