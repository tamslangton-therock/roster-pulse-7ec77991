// Google Sheet configuration. The spreadsheet ID is public config (not a secret).
// If you swap sheets later, change this one value.
export const SPREADSHEET_ID = "1TCyWcdxXx-E_8b6isbYXynXuHDTfQrJbo6p9J3D7YHs";

export const SHEET_TABS = {
  volunteers: "Volunteers",
  teams: "Teams",
  assignments: "Assignments",
} as const;

export type SheetTab = keyof typeof SHEET_TABS;

// Column schemas — the app writes these headers to row 1 on first sync
// and reads by header name, so column order in your sheet doesn't matter.
export const SHEET_SCHEMAS: Record<SheetTab, readonly string[]> = {
  volunteers: [
    "id",
    "full_name",
    "email",
    "phone",
    "serving_areas",
    "partners",
    "max_serving_per_month",
    "frequency_preference",
    "priority_area",
    "is_paused",
    "notes",
    "unavailable_dates",
    "is_volunteer",
    "context",
    "challenges",
    "praying_for",
  ],
  teams: ["id", "team_name", "serving_area", "member_names"],
  assignments: [
    "id",
    "date",
    "area",
    "role",
    "label",
    "person_name",
    "team_name",
    "is_override",
    "notes",
    "status",
  ],
};

// Cells that hold arrays are serialized as pipe-delimited strings.
export const ARRAY_FIELDS: Record<SheetTab, readonly string[]> = {
  volunteers: ["serving_areas", "partners", "unavailable_dates"],
  teams: ["member_names"],
  assignments: [],
};

export const BOOL_FIELDS: Record<SheetTab, readonly string[]> = {
  volunteers: ["is_paused", "is_volunteer"],
  teams: [],
  assignments: ["is_override"],
};

export const NUMBER_FIELDS: Record<SheetTab, readonly string[]> = {
  volunteers: ["max_serving_per_month"],
  teams: [],
  assignments: [],
};

// Wide grid tab (dates as rows, serving-area slots as columns).
export const LIVE_ROSTER_TAB = "Live_Roster";

// Date block-outs / unavailability — editable directly in the sheet.
export const BLOCKOUTS_TAB = "Blockouts";
export const BLOCKOUTS_SCHEMA = ["person_name", "date", "reason"] as const;


// Confirmation statuses per roster slot — editable directly in the sheet.
// Only non-pending rows are stored, so the tab stays short.
export const STATUSES_TAB = "Statuses";
export const STATUSES_SCHEMA = [
  "date",
  "slot",
  "person_name",
  "status",
  "updated_at",
] as const;

// Allowed clash exceptions — pairs of serving areas (or "Area — Role" labels)
// that a person MAY serve in on the same date. Everything else counts as a clash.
export const ALLOWED_CLASHES_TAB = "Allowed_Clashes";
export const ALLOWED_CLASHES_SCHEMA = ["area_a", "area_b", "notes"] as const;

// Sub-teams: ideal groupings inside a serving area (e.g. Barista → "Team A"
// with Milk / Coffee Shots / Cashier). One row per slot within a sub-team, so
// the tab is easy to edit by hand.
export const SUB_TEAMS_TAB = "Sub_Teams";
export const SUB_TEAMS_SCHEMA = [
  "serving_area",
  "sub_team_name",
  "slot_label",
  "person_name",
  "color",
] as const;

// Life Groups — one row per group; members are pipe-separated names.
export const LIFE_GROUPS_TAB = "Life_Groups";
export const LIFE_GROUPS_SCHEMA = [
  "GroupID",
  "GroupName",
  "Leaders",
  "MeetingDayTime",
  "LocationName",
  "StreetAddress",
  "Description",
  "MembersList",
] as const;

// Sunday Docs template — the editable draft the generator fills names into.
export const DOC_TEMPLATE_TAB = "Doc_Template";
export const DOC_TEMPLATE_SCHEMA = [
  "section_id",
  "section_title",
  "section_type",
  "page_break",
  "row_order",
  "col_a",
  "col_b",
  "col_c",
] as const;

// Team-leader logins and their permissions. One row per user; area scopes are
// pipe-separated serving-area names (empty roster_view_areas = all areas).
export const USER_ACCESS_TAB = "User_Access";
export const USER_ACCESS_SCHEMA = [
  "username",
  "password",
  "display_name",
  "roster_view_areas",
  "roster_edit_areas",
  "can_view_health",
  "team_edit_areas",
  "individuals_access",
  "can_view_roster",
  "can_view_life_groups",
] as const;

/** Row shape as stored in the sheet (raw strings). */
export interface UserAccessTabValues {
  username: string;
  password: string;
  display_name: string;
  roster_view_areas: string[];
  roster_edit_areas: string[];
  can_view_health: boolean;
  team_edit_areas: string[];
  individuals_access: string;
  /** Blank in the sheet means yes — existing logins keep roster access. */
  can_view_roster: boolean;
  can_view_life_groups: boolean;
}
