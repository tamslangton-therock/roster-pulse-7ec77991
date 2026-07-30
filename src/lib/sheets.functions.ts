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
  STATUSES_TAB,
  STATUSES_SCHEMA,
  ALLOWED_CLASHES_TAB,
  ALLOWED_CLASHES_SCHEMA,
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

// ---------- Blockouts (date block-outs / unavailability) ----------

export interface BlockoutRow {
  person_name: string;
  date: string; // ISO YYYY-MM-DD
  reason: string;
}

async function ensureBlockoutsTab() {
  try {
    const data = await gwFetch(
      `/spreadsheets/${SPREADSHEET_ID}/values/${BLOCKOUTS_TAB}!1:1`,
    );
    if (((data.values?.[0] ?? []) as string[]).length === 0) {
      await gwFetch(
        `/spreadsheets/${SPREADSHEET_ID}/values/${BLOCKOUTS_TAB}!A1?valueInputOption=RAW`,
        { method: "PUT", body: JSON.stringify({ values: [BLOCKOUTS_SCHEMA.slice()] }) },
      );
    }
  } catch {
    await gwFetch(`/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: BLOCKOUTS_TAB,
                gridProperties: { frozenRowCount: 1 },
              },
            },
          },
        ],
      }),
    });
    await gwFetch(
      `/spreadsheets/${SPREADSHEET_ID}/values/${BLOCKOUTS_TAB}!A1?valueInputOption=RAW`,
      { method: "PUT", body: JSON.stringify({ values: [BLOCKOUTS_SCHEMA.slice()] }) },
    );
  }
}

export const fetchBlockouts = createServerFn({ method: "GET" }).handler(
  async (): Promise<BlockoutRow[]> => {
    await ensureBlockoutsTab();
    let data: { values?: string[][] };
    try {
      data = await gwFetch(
        `/spreadsheets/${SPREADSHEET_ID}/values/${BLOCKOUTS_TAB}!A1:C2000`,
      );
    } catch {
      return [];
    }
    const rows = (data.values ?? []).slice(1);
    const out: BlockoutRow[] = [];
    for (const r of rows) {
      const person_name = String(r[0] ?? "").trim();
      const iso = normalizeDate(String(r[1] ?? ""));
      if (!person_name || !iso) continue;
      out.push({ person_name, date: iso, reason: String(r[2] ?? "").trim() });
    }
    return out;
  },
);

export const writeBlockouts = createServerFn({ method: "POST" })
  .inputValidator((data: { rows: BlockoutRow[] }) => data)
  .handler(async ({ data }) => {
    await ensureBlockoutsTab();
    await gwFetch(
      `/spreadsheets/${SPREADSHEET_ID}/values/${BLOCKOUTS_TAB}!A1:C2000:clear`,
      { method: "POST", body: "{}" },
    );
    const values: string[][] = [
      BLOCKOUTS_SCHEMA.slice(),
      ...data.rows.map((r) => [r.person_name, r.date, r.reason ?? ""]),
    ];
    await gwFetch(
      `/spreadsheets/${SPREADSHEET_ID}/values/${BLOCKOUTS_TAB}!A1?valueInputOption=RAW`,
      { method: "PUT", body: JSON.stringify({ values }) },
    );
    return { ok: true, count: data.rows.length };
  });

// ---------- Statuses (per-slot confirmation state) ----------

export interface StatusRow {
  date: string; // ISO YYYY-MM-DD
  slot: string; // roster slot label
  person_name: string;
  status: string; // pending | reminder_sent | declined | confirmed
  updated_at: string;
}

async function ensureStatusesTab() {
  try {
    const data = await gwFetch(
      `/spreadsheets/${SPREADSHEET_ID}/values/${STATUSES_TAB}!1:1`,
    );
    if (((data.values?.[0] ?? []) as string[]).length === 0) {
      await gwFetch(
        `/spreadsheets/${SPREADSHEET_ID}/values/${STATUSES_TAB}!A1?valueInputOption=RAW`,
        { method: "PUT", body: JSON.stringify({ values: [STATUSES_SCHEMA.slice()] }) },
      );
    }
  } catch {
    await gwFetch(`/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: STATUSES_TAB,
                gridProperties: { frozenRowCount: 1 },
              },
            },
          },
        ],
      }),
    });
    await gwFetch(
      `/spreadsheets/${SPREADSHEET_ID}/values/${STATUSES_TAB}!A1?valueInputOption=RAW`,
      { method: "PUT", body: JSON.stringify({ values: [STATUSES_SCHEMA.slice()] }) },
    );
  }
}

const VALID_STATUSES = ["pending", "reminder_sent", "declined", "confirmed"];

export const fetchStatuses = createServerFn({ method: "GET" }).handler(
  async (): Promise<StatusRow[]> => {
    await ensureStatusesTab();
    let data: { values?: string[][] };
    try {
      data = await gwFetch(
        `/spreadsheets/${SPREADSHEET_ID}/values/${STATUSES_TAB}!A1:E5000`,
      );
    } catch {
      return [];
    }
    const rows = (data.values ?? []).slice(1);
    const out: StatusRow[] = [];
    for (const r of rows) {
      const date = normalizeDate(String(r[0] ?? ""));
      const slot = String(r[1] ?? "").trim();
      const status = String(r[3] ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
      if (!date || !slot || !VALID_STATUSES.includes(status)) continue;
      out.push({
        date,
        slot,
        person_name: String(r[2] ?? "").trim(),
        status,
        updated_at: String(r[4] ?? "").trim(),
      });
    }
    return out;
  },
);

export const writeStatuses = createServerFn({ method: "POST" })
  .inputValidator((data: { rows: StatusRow[] }) => data)
  .handler(async ({ data }) => {
    await ensureStatusesTab();
    await gwFetch(
      `/spreadsheets/${SPREADSHEET_ID}/values/${STATUSES_TAB}!A1:E5000:clear`,
      { method: "POST", body: "{}" },
    );
    const values: string[][] = [
      STATUSES_SCHEMA.slice(),
      ...data.rows.map((r) => [
        r.date,
        r.slot,
        r.person_name ?? "",
        r.status,
        r.updated_at ?? "",
      ]),
    ];
    await gwFetch(
      `/spreadsheets/${SPREADSHEET_ID}/values/${STATUSES_TAB}!A1?valueInputOption=RAW`,
      { method: "PUT", body: JSON.stringify({ values }) },
    );
    return { ok: true, count: data.rows.length };
  });

// ---------- Allowed clash exceptions ----------

export interface AllowedClashRow {
  area_a: string;
  area_b: string;
  notes: string;
}

async function ensureAllowedClashesTab() {
  try {
    const data = await gwFetch(
      `/spreadsheets/${SPREADSHEET_ID}/values/${ALLOWED_CLASHES_TAB}!1:1`,
    );
    if (((data.values?.[0] ?? []) as string[]).length === 0) {
      await gwFetch(
        `/spreadsheets/${SPREADSHEET_ID}/values/${ALLOWED_CLASHES_TAB}!A1?valueInputOption=RAW`,
        { method: "PUT", body: JSON.stringify({ values: [ALLOWED_CLASHES_SCHEMA.slice()] }) },
      );
    }
  } catch {
    await gwFetch(`/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: ALLOWED_CLASHES_TAB,
                gridProperties: { frozenRowCount: 1 },
              },
            },
          },
        ],
      }),
    });
    await gwFetch(
      `/spreadsheets/${SPREADSHEET_ID}/values/${ALLOWED_CLASHES_TAB}!A1?valueInputOption=RAW`,
      { method: "PUT", body: JSON.stringify({ values: [ALLOWED_CLASHES_SCHEMA.slice()] }) },
    );
  }
}

export const fetchAllowedClashes = createServerFn({ method: "GET" }).handler(
  async (): Promise<AllowedClashRow[]> => {
    await ensureAllowedClashesTab();
    let data: { values?: string[][] };
    try {
      data = await gwFetch(
        `/spreadsheets/${SPREADSHEET_ID}/values/${ALLOWED_CLASHES_TAB}!A1:C500`,
      );
    } catch {
      return [];
    }
    const out: AllowedClashRow[] = [];
    for (const r of (data.values ?? []).slice(1)) {
      const area_a = String(r[0] ?? "").trim();
      const area_b = String(r[1] ?? "").trim();
      if (!area_a || !area_b) continue;
      out.push({ area_a, area_b, notes: String(r[2] ?? "").trim() });
    }
    return out;
  },
);

export const writeAllowedClashes = createServerFn({ method: "POST" })
  .inputValidator((data: { rows: AllowedClashRow[] }) => data)
  .handler(async ({ data }) => {
    await ensureAllowedClashesTab();
    await gwFetch(
      `/spreadsheets/${SPREADSHEET_ID}/values/${ALLOWED_CLASHES_TAB}!A1:C500:clear`,
      { method: "POST", body: "{}" },
    );
    const values: string[][] = [
      ALLOWED_CLASHES_SCHEMA.slice(),
      ...data.rows.map((r) => [r.area_a, r.area_b, r.notes ?? ""]),
    ];
    await gwFetch(
      `/spreadsheets/${SPREADSHEET_ID}/values/${ALLOWED_CLASHES_TAB}!A1?valueInputOption=RAW`,
      { method: "PUT", body: JSON.stringify({ values }) },
    );
    return { ok: true, count: data.rows.length };
  });
