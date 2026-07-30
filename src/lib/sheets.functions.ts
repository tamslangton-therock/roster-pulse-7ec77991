import { createServerFn } from "@tanstack/react-start";
import {
  SPREADSHEET_ID,
  SHEET_TABS,
  SHEET_SCHEMAS,
  ARRAY_FIELDS,
  BOOL_FIELDS,
  NUMBER_FIELDS,
  LIVE_ROSTER_TAB,
  BLOCKOUTS_TAB,
  BLOCKOUTS_SCHEMA,
  type SheetTab,
} from "./sheets-config";

import {
  ROSTER_SLOTS,
  DETAIL_COL,
  FIRST_DATA_ROW,
  headerRows,
  clashFormula,
} from "./roster-grid";

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

function gatewayHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lovableKey || !connKey) {
    throw new Error(
      "Google Sheets connector is not configured (missing LOVABLE_API_KEY or GOOGLE_SHEETS_API_KEY).",
    );
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connKey,
    "Content-Type": "application/json",
  };
}

async function gwFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: { ...gatewayHeaders(), ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets ${init.method ?? "GET"} ${path} failed [${res.status}]: ${text}`);
  }
  return res.json();
}

function encodeCell(value: unknown, field: string, tab: SheetTab): string {
  if (value === null || value === undefined) return "";
  if ((ARRAY_FIELDS[tab] as readonly string[]).includes(field)) {
    return Array.isArray(value) ? value.join(" | ") : String(value);
  }
  if ((BOOL_FIELDS[tab] as readonly string[]).includes(field)) {
    return value ? "TRUE" : "FALSE";
  }
  return String(value);
}

type CellValue = string | number | boolean | string[];

function decodeCell(raw: unknown, field: string, tab: SheetTab): CellValue {
  const s = raw == null ? "" : String(raw).trim();
  if ((ARRAY_FIELDS[tab] as readonly string[]).includes(field)) {
    if (!s) return [] as string[];
    return s.split(/\s*[|,;]\s*/).filter(Boolean);
  }
  if ((BOOL_FIELDS[tab] as readonly string[]).includes(field)) {
    return /^(true|1|yes|y)$/i.test(s);
  }
  if ((NUMBER_FIELDS[tab] as readonly string[]).includes(field)) {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  return s;
}

export type SheetRow = Record<string, CellValue>;

async function ensureTabWithHeaders(tab: SheetTab) {
  const title = SHEET_TABS[tab];
  const schema = SHEET_SCHEMAS[tab];
  // Try to read row 1
  try {
    const data = await gwFetch(
      `/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(title)}!1:1`,
    );
    const header = (data.values?.[0] ?? []) as string[];
    if (header.length === 0) {
      // Tab exists but empty — write headers
      await gwFetch(
        `/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(title)}!A1?valueInputOption=RAW`,
        { method: "PUT", body: JSON.stringify({ values: [schema] }) },
      );
      return schema.slice();
    }
    return header;
  } catch (err) {
    // Tab probably doesn't exist — create it
    const msg = err instanceof Error ? err.message : String(err);
    if (/Unable to parse range|not found|400/i.test(msg)) {
      await gwFetch(`/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
        method: "POST",
        body: JSON.stringify({
          requests: [{ addSheet: { properties: { title } } }],
        }),
      });
      await gwFetch(
        `/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(title)}!A1?valueInputOption=RAW`,
        { method: "PUT", body: JSON.stringify({ values: [schema] }) },
      );
      return schema.slice();
    }
    throw err;
  }
}

// ---------- Server functions ----------

export const fetchAllTabs = createServerFn({ method: "GET" }).handler(async () => {
  const result: Record<SheetTab, SheetRow[]> = {
    volunteers: [],
    teams: [],
    assignments: [],
  };
  for (const tab of Object.keys(SHEET_TABS) as SheetTab[]) {
    const header = await ensureTabWithHeaders(tab);
    const title = SHEET_TABS[tab];
    const data = await gwFetch(
      `/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(title)}`,
    );
    const rows = (data.values ?? []) as string[][];
    const dataRows = rows.slice(1);
    const schema = SHEET_SCHEMAS[tab];
    result[tab] = dataRows
      .filter((r) => r.some((c) => (c ?? "").toString().trim() !== ""))
      .map((r): SheetRow => {
        const obj: SheetRow = {};
        for (const field of schema) {
          const idx = header.indexOf(field);
          obj[field] = decodeCell(idx >= 0 ? r[idx] : "", field, tab);
        }
        return obj;
      });
  }
  return result;
});

export const writeTab = createServerFn({ method: "POST" })
  .inputValidator((data: { tab: SheetTab; rows: Array<Record<string, unknown>> }) => data)
  .handler(async ({ data }) => {
    const { tab, rows } = data;
    const title = SHEET_TABS[tab];
    const schema = SHEET_SCHEMAS[tab];
    await ensureTabWithHeaders(tab);
    // Clear all existing data
    await gwFetch(
      `/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(title)}:clear`,
      { method: "POST", body: "{}" },
    );
    // Rewrite header + rows
    const values: string[][] = [
      schema.slice(),
      ...rows.map((row) => schema.map((f) => encodeCell(row[f], f, tab))),
    ];
    await gwFetch(
      `/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(title)}!A1?valueInputOption=RAW`,
      { method: "PUT", body: JSON.stringify({ values }) },
    );
    return { ok: true, count: rows.length };
  });

// ---------- Live_Roster (wide grid) ----------

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

export interface LiveRosterRow {
  date: string;
  label: string; // original cell text (may include "EASTER SUNDAY" etc.)
  cells: Record<string, string>; // slot label -> person name
  notes: string;
  detail: string;
}

export const fetchLiveRoster = createServerFn({ method: "GET" }).handler(
  async (): Promise<LiveRosterRow[]> => {
    const range = `${LIVE_ROSTER_TAB}!A1:${DETAIL_COL}2000`;
    let data: { values?: string[][] };
    try {
      data = await gwFetch(`/spreadsheets/${SPREADSHEET_ID}/values/${range}`);
    } catch {
      return [];
    }
    const rows = data.values ?? [];
    const out: LiveRosterRow[] = [];
    for (let r = FIRST_DATA_ROW - 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const rawDate = String(row[0] ?? "");
      const iso = normalizeDate(rawDate);
      if (!iso) continue;
      const cells: Record<string, string> = {};
      ROSTER_SLOTS.forEach((slot, i) => {
        const v = String(row[i + 1] ?? "").trim();
        if (v) cells[slot.label] = v;
      });
      out.push({
        date: iso,
        label: rawDate.trim(),
        cells,
        notes: String(row[ROSTER_SLOTS.length + 2] ?? "").trim(),
        detail: String(row[ROSTER_SLOTS.length + 3] ?? "").trim(),
      });
    }
    return out;
  },
);

export const writeLiveRoster = createServerFn({ method: "POST" })
  .inputValidator((data: { rows: LiveRosterRow[] }) => data)
  .handler(async ({ data }) => {
    const { rows } = data;
    await ensureLiveRosterTab();
    await gwFetch(
      `/spreadsheets/${SPREADSHEET_ID}/values/${LIVE_ROSTER_TAB}!A1:${DETAIL_COL}2000:clear`,
      { method: "POST", body: "{}" },
    );
    const values: string[][] = [...headerRows()];
    rows.forEach((row, i) => {
      const sheetRow = FIRST_DATA_ROW + i;
      values.push([
        `'${row.label || row.date}`,
        ...ROSTER_SLOTS.map((s) => row.cells[s.label] ?? ""),
        clashFormula(sheetRow),
        row.notes ?? "",
        row.detail ?? "",
      ]);
    });
    await gwFetch(
      `/spreadsheets/${SPREADSHEET_ID}/values/${LIVE_ROSTER_TAB}!A1?valueInputOption=USER_ENTERED`,
      { method: "PUT", body: JSON.stringify({ values }) },
    );
    return { ok: true, count: rows.length };
  });

async function ensureLiveRosterTab() {
  try {
    await gwFetch(`/spreadsheets/${SPREADSHEET_ID}/values/${LIVE_ROSTER_TAB}!A1:A1`);
  } catch {
    await gwFetch(`/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({
        requests: [
          { addSheet: { properties: { title: LIVE_ROSTER_TAB, gridProperties: { frozenRowCount: 2, frozenColumnCount: 1 } } } },
        ],
      }),
    });
  }
}
