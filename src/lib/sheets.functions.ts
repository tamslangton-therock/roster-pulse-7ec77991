import { createServerFn } from "@tanstack/react-start";
import {
  SPREADSHEET_ID,
  SHEET_TABS,
  SHEET_SCHEMAS,
  ARRAY_FIELDS,
  BOOL_FIELDS,
  NUMBER_FIELDS,
  type SheetTab,
} from "./sheets-config";

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
