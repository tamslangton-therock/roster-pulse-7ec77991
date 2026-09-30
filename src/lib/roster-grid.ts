// Wide "Live_Roster" grid definition — mirrors the church's spreadsheet layout.
// Row 1 = serving area, Row 2 = role / slot, Row 3+ = one row per date.
// The column layout is now DYNAMIC: the app derives the slot list from the
// Live_Roster header rows (Row 1 & 2), and layout edits — extra slots on an
// area, brand-new serving teams, reordering — are written back so the app and
// the Google Sheet stay interchangeable.

export interface SlotDef {
  /** Spreadsheet column letter */
  col: string;
  /** Serving area (row 1) */
  area: string;
  /** Role / slot name (row 2) — may be "" for plain numbered slots */
  role: string;
  /** Unique label used as the app's column key and Assignment.label */
  label: string;
}

/** [area, role, count] — the default column layout used to seed a new grid. */
export type SlotSpec = Array<[string, string, number]>;

export const DEFAULT_SLOT_SPEC: SlotSpec = [
  ["Car Park", "", 2],
  ["Count", "", 2],
  ["Tea", "", 2],
  ["Hosting", "", 6],
  ["Hang Tight", "", 2],
  ["Host", "", 1],
  ["Welcome", "", 6],
  ["Barista", "Milk", 1],
  ["Barista", "Coffee Shots", 1],
  ["Barista", "Cashier", 1],
  ["Lift To Marlene", "", 1],
  ["Media", "", 1],
  ["Camera", "", 1],
  ["Bacon and Egg", "", 3],
  ["Preach", "", 1],
  ["MC", "", 1],
  ["Kids", "Yellow 8AM", 2],
  ["Kids", "Yellow 10AM", 2],
  ["Kids", "Green 8AM", 2],
  ["Kids", "Green 10AM", 2],
  ["Kids", "Teens", 2],
  ["Worship", "Leader", 1],
  ["Worship", "Co-Leader", 1],
  ["Worship", "Vocals", 2],
  ["Worship", "Keys", 1],
  ["Worship", "Electric Guitar", 1],
  ["Worship", "Drums", 1],
  ["Worship", "Bass Guitar", 1],
  ["Worship", "Acoustic Guitar", 1],
  ["Worship", "Sound", 1],
];

export function colLetter(index: number): string {
  let n = index;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Expand a spec into SlotDefs, numbering repeated area/role groups (Car Park 1, 2, 3…). */
export function buildSlots(spec: SlotSpec): SlotDef[] {
  // Count how many columns share each (area, role) pair so duplicates get numbers.
  const groupSize = new Map<string, number>();
  for (const [area, role] of spec) {
    const key = `${area}\u0000${role}`;
    groupSize.set(key, (groupSize.get(key) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  const slots: SlotDef[] = [];
  let index = 2; // column B
  for (const [area, role] of spec) {
    const key = `${area}\u0000${role}`;
    const size = groupSize.get(key) ?? 1;
    const occurrence = (seen.get(key) ?? 0) + 1;
    seen.set(key, occurrence);
    const base = role ? `${area} — ${role}` : area;
    const label = size > 1 ? `${base} ${occurrence}` : base;
    slots.push({ col: colLetter(index), area, role, label });
    index++;
  }
  return slots;
}

const TAIL_HEADERS = /^(clash alert|notes|detail)$/i;

/**
 * Parse the Live_Roster header rows (Row 1 = area, Row 2 = role) into SlotDefs,
 * so column changes made directly in Google Sheets flow into the app.
 * Returns null when the header rows don't look like a valid grid.
 */
export function slotsFromHeaders(areaRow: unknown[], roleRow: unknown[]): SlotDef[] | null {
  const slots: SlotDef[] = [];
  // First pass: collect (area, role) columns and count duplicates for numbering.
  const columns: Array<{ area: string; role: string }> = [];
  for (let i = 1; i < areaRow.length; i++) {
    const area = String(areaRow[i] ?? "").trim();
    if (!area || TAIL_HEADERS.test(area)) break; // end of slots (Clash Alert / NOTES / DETAIL)
    columns.push({ area, role: String(roleRow[i] ?? "").trim() });
  }
  if (columns.length === 0) return null;

  const groupSize = new Map<string, number>();
  for (const c of columns) {
    const key = `${c.area}\u0000${c.role}`;
    groupSize.set(key, (groupSize.get(key) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  columns.forEach((c, i) => {
    const key = `${c.area}\u0000${c.role}`;
    const size = groupSize.get(key) ?? 1;
    const occurrence = (seen.get(key) ?? 0) + 1;
    seen.set(key, occurrence);
    const base = c.role ? `${c.area} — ${c.role}` : c.area;
    const label = size > 1 ? `${base} ${occurrence}` : base;
    slots.push({ col: colLetter(i + 2), area: c.area, role: c.role, label });
  });
  return slots;
}

/** Group slots back into a spec (for editing UIs). */
export function specFromSlots(slots: SlotDef[]): SlotSpec {
  const spec: SlotSpec = [];
  for (const s of slots) {
    const last = spec[spec.length - 1];
    if (last && last[0] === s.area && last[1] === s.role) last[2] += 1;
    else spec.push([s.area, s.role, 1]);
  }
  return spec;
}

/** Ordered, de-duplicated list of serving areas for a slot list. */
export function areasOf(slots: SlotDef[]): string[] {
  return Array.from(new Set(slots.map((s) => s.area)));
}

export function lastSlotCol(slots: SlotDef[]): string {
  return slots.length ? slots[slots.length - 1].col : "A";
}

export function headerRows(slots: SlotDef[]): string[][] {
  const areaRow = ["DATE", ...slots.map((s) => s.area), "Clash Alert", "NOTES", "DETAIL"];
  const roleRow = ["", ...slots.map((s) => s.role), "", "", ""];
  return [areaRow, roleRow];
}

/**
 * Google Sheets clash formula for a data row — flags any person appearing in
 * more than one slot on that date and names the slots they clash in.
 * NOTE: COUNTIF / IF over a range only expand elementwise inside ARRAYFORMULA;
 * without it the whole check collapses to a single value and never fires.
 * The formula range is derived from the CURRENT slot count, so it stays
 * correct after columns are added, removed or reordered.
 */
export function clashFormula(row: number, slotCount: number, allowClashesTab: string): string {
  const last = colLetter(slotCount + 1);
  const R = `$${FIRST_SLOT_COL}${row}:$${last}${row}`;
  const A = `$${FIRST_SLOT_COL}$1:$${last}$1`;
  const H2 = `$${FIRST_SLOT_COL}$2:$${last}$2`;
  const EXA = `'${allowClashesTab}'!$A$2:$A`;
  const EXB = `'${allowClashesTab}'!$B$2:$B`;
  return (
    `=IFERROR(LET(` +
    `r,ARRAYFORMULA(TRIM(${R})),` +
    `a,ARRAYFORMULA(TRIM(${A})),` +
    `h,ARRAYFORMULA(TRIM(${A})&IF(${H2}="",""," — "&${H2})),` +
    `ex,TEXTJOIN("~",TRUE,IFERROR(TOCOL(ARRAYFORMULA(IF(TRIM(${EXA})="",NA(),LOWER(TRIM(${EXA})&"||"&TRIM(${EXB})&"~"&TRIM(${EXB})&"||"&TRIM(${EXA})))),3),"")),` +
    `names,IFERROR(UNIQUE(TOCOL(ARRAYFORMULA(IF((COUNTIF(r,r)>1)*(r<>""),r,NA())),3)),""),` +
    `msg,IF(COUNTA(names)=0,"",TEXTJOIN(" | ",TRUE,MAP(names,LAMBDA(n,LET(` +
    `ar,TOCOL(ARRAYFORMULA(IF(r=n,a,NA())),3),` +
    `sl,TOCOL(ARRAYFORMULA(IF(r=n,h,NA())),3),` +
    `pk,LOWER(INDEX(ar,1)&"||"&INDEX(ar,2)),` +
    `ps,LOWER(INDEX(sl,1)&"||"&INDEX(sl,2)),` +
    `okp,IF(COUNTA(ar)<>2,FALSE,ISNUMBER(SEARCH("~"&pk&"~","~"&ex&"~"))+ISNUMBER(SEARCH("~"&ps&"~","~"&ex&"~"))>0),` +
    `IF(okp,"",n&" IN "&TEXTJOIN(" & ",TRUE,sl))))))),` +
    `IF(msg="","✓","⚠️ CLASH: "&msg)` +
    `),"✓")`
  );
}

/** ISO date strings for every Sunday between two dates (inclusive). */
export function sundaysBetween(start: Date, end: Date): string[] {
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() + 1);
  const out: string[] = [];
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}

/** Default seed window: Sundays from 1 Aug of the current year through 12 months out. */
export function defaultSundayWindow(from: Date = new Date()): string[] {
  const start = new Date(Date.UTC(from.getUTCFullYear(), 7, 1)); // 1 August
  const end = new Date(Date.UTC(from.getUTCFullYear() + 1, 6, 31));
  return sundaysBetween(start, end);
}

// ---- Backwards-compatible defaults (used before the grid hydrates) ----

export const ROSTER_SLOTS: SlotDef[] = buildSlots(DEFAULT_SLOT_SPEC);
export const SLOT_COUNT = ROSTER_SLOTS.length;
export const FIRST_SLOT_COL = "B";
export const LAST_SLOT_COL = lastSlotCol(ROSTER_SLOTS);
export const CLASH_COL = colLetter(SLOT_COUNT + 2);
export const NOTES_COL = colLetter(SLOT_COUNT + 3);
export const DETAIL_COL = colLetter(SLOT_COUNT + 4);
export const HEADER_ROWS = 2;
export const FIRST_DATA_ROW = HEADER_ROWS + 1;

export const ROSTER_AREAS: string[] = areasOf(ROSTER_SLOTS);

export function slotByLabel(label: string, slots: SlotDef[] = ROSTER_SLOTS): SlotDef | undefined {
  return slots.find((s) => s.label === label);
}
