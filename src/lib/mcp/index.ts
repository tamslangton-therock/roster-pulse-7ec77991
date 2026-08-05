import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listRoster from "./tools/list-roster";
import getSunday from "./tools/get-sunday";
import getPersonSchedule from "./tools/get-person-schedule";
import listVolunteers from "./tools/list-volunteers";

// The OAuth issuer must be the direct Supabase host; the project ref is the only
// value that survives publish unchanged.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "roster-pulse",
  title: "Roster Pulse",
  version: "0.1.0",
  instructions:
    "Read-only tools for the Roster Pulse church roster. Use `list_roster` for date ranges or team views, `get_sunday` for one date, `get_person_schedule` to see why someone may be over-serving, and `list_volunteers` for preferences and paused state.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listRoster, getSunday, getPersonSchedule, listVolunteers],
});
