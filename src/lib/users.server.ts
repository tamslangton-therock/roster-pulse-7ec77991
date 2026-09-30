// Server-only helpers for the team-leader login. Reads the User_Access tab
// directly through the Google Sheets connector so credentials never reach the
// browser bundle.
import {
  SPREADSHEET_ID,
  USER_ACCESS_TAB,
  type UserAccessTabValues,
} from "./sheets-config";

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

function gatewayHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lovableKey || !connKey) {
    throw new Error("Google Sheets connector is not configured.");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connKey,
    "Content-Type": "application/json",
  };
}

async function gwFetch(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: { ...gatewayHeaders(), ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    throw new Error(`Sheets ${init.method ?? "GET"} ${path} failed [${res.status}]`);
  }
  return res.json();
}

const toList = (s: string) =>
  String(s ?? "")
    .split(/\s*[|,;]\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
const toBool = (s: string, fallback = false) => {
  const v = String(s ?? "").trim();
  if (!v) return fallback;
  return /^(true|1|yes|y)$/i.test(v);
};

/**
 * Reads every user row from the User_Access tab. Returns [] when the tab
 * doesn't exist yet.
 */
export async function readUserAccessRows(): Promise<UserAccessTabValues[]> {
  let data: { values?: string[][] };
  try {
    data = await gwFetch(`/spreadsheets/${SPREADSHEET_ID}/values/${USER_ACCESS_TAB}!A1:J2000`);
  } catch {
    return [];
  }
  const rows = (data.values ?? []) as string[][];
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => String(h).trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name.toLowerCase());
  const cell = (r: string[], name: string) => {
    const i = idx(name);
    return i < 0 ? "" : String(r[i] ?? "");
  };
  const out: UserAccessTabValues[] = [];
  for (const r of rows.slice(1)) {
    const username = cell(r, "username").trim();
    if (!username) continue;
    out.push({
      username,
      password: cell(r, "password").trim(),
      display_name: cell(r, "display_name").trim(),
      roster_view_areas: toList(cell(r, "roster_view_areas")),
      roster_edit_areas: toList(cell(r, "roster_edit_areas")),
      can_view_health: toBool(cell(r, "can_view_health")),
      team_edit_areas: toList(cell(r, "team_edit_areas")),
      individuals_access: cell(r, "individuals_access").trim(),
      can_view_roster: toBool(cell(r, "can_view_roster"), true),
      can_view_life_groups: toBool(cell(r, "can_view_life_groups")),
    });
  }
  return out;
}
