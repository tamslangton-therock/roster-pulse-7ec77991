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
  volunteers: ["is_paused"],
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

