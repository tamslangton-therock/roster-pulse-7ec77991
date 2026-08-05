// Server-only Google Sheets reader used by the MCP tools.
// Import-safe: no env reads or I/O at module scope.
import { SPREADSHEET_ID, SHEET_TABS, LIVE_ROSTER_TAB } from "../sheets-config";
import { ROSTER_SLOTS, DETAIL_COL, FIRST_DATA_ROW } from "../roster-grid";

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

function gatewayHeaders(): Record<string, string> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connKey = process.env["GOOGLE_SHEETS_API_KEY"];
  if (!lovableKey || !connKey) {
    throw new Error("Google Sheets connector is not configured on the server.");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connKey,
    "Content-Type": "application/json",
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function gwFetch(path: string): Promise<{ values?: string[][] }> {
  let lastStatus = 0;
  let lastText = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${GATEWAY}${path}`, { headers: gatewayHeaders() });
    if (res.ok) return (await res.json()) as { values?: string[][] };
    lastStatus = res.status;
    lastText = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await sleep(Math.min(6000, 500 * 2 ** attempt));
      continue;
    }
    break;
  }
  throw new Error(`Sheets read failed [${lastStatus}]: ${lastText.slice(0, 300)}`);
}

function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/\s]([A-Za-z]{3,})[-/\s](\d{4})/);
  if (m) {
    const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
    const mi = months.indexOf(m[2].slice(0, 3).toLowerCase());
    if (mi >= 0) return `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

export interface RosterEntry {
  date: string;
  area: string;
  role: string;
  slot: string;
  person: string;
}

/** Flattened Live_Roster: one entry per filled slot. */
export async function readRoster(): Promise<RosterEntry[]> {
  const range = `${LIVE_ROSTER_TAB}!A1:${DETAIL_COL}2000`;
  const data = await gwFetch(
    `/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`,
  );
  const rows = data.values ?? [];
  const out: RosterEntry[] = [];
  for (let r = FIRST_DATA_ROW - 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const iso = normalizeDate(String(row[0] ?? ""));
    if (!iso) continue;
    ROSTER_SLOTS.forEach((slot, i) => {
      const person = String(row[i + 1] ?? "").trim();
      if (!person) return;
      out.push({ date: iso, area: slot.area, role: slot.role, slot: slot.label, person });
    });
  }
  return out;
}

export interface VolunteerRecord {
  full_name: string;
  serving_areas: string[];
  partners: string[];
  max_serving_per_month: number;
  frequency_preference: string;
  priority_area: string;
  is_paused: boolean;
  notes: string;
}

/** Volunteers tab (contact details are intentionally not returned). */
export async function readVolunteers(): Promise<VolunteerRecord[]> {
  const title = SHEET_TABS.volunteers;
  const data = await gwFetch(
    `/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(title)}`,
  );
  const rows = data.values ?? [];
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => String(h ?? "").trim());
  const at = (row: string[], field: string) => {
    const i = header.indexOf(field);
    return i >= 0 ? String(row[i] ?? "").trim() : "";
  };
  const list = (v: string) => (v ? v.split(/\s*[|,;]\s*/).filter(Boolean) : []);
  return rows
    .slice(1)
    .filter((r) => at(r, "full_name"))
    .map((r) => ({
      full_name: at(r, "full_name"),
      serving_areas: list(at(r, "serving_areas")),
      partners: list(at(r, "partners")),
      max_serving_per_month: Number(at(r, "max_serving_per_month")) || 0,
      frequency_preference: at(r, "frequency_preference"),
      priority_area: at(r, "priority_area"),
      is_paused: /^(true|1|yes|y)$/i.test(at(r, "is_paused")),
      notes: at(r, "notes"),
    }));
}
