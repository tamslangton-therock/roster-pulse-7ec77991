import { ALLOWED_CLASHES_TAB } from "./sheets-config";

// Wide "Live_Roster" grid definition — mirrors the church's spreadsheet layout.
// Row 1 = serving area, Row 2 = role / slot, Row 3+ = one row per date.
// Columns B..BA are slots; BB = Clash Alert formula, BC = NOTES, BD = DETAIL.

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

function build(): SlotDef[] {
  const spec: Array<[string, string, number]> = [
    // [area, role, count]
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

  const slots: SlotDef[] = [];
  let index = 2; // column B
  for (const [area, role, count] of spec) {
    for (let i = 1; i <= count; i++) {
      const base = role ? `${area} — ${role}` : area;
      const label = count > 1 ? `${base} ${i}` : base;
      slots.push({ col: colLetter(index), area, role, label });
      index++;
    }
  }
  return slots;
}

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

export const ROSTER_SLOTS: SlotDef[] = build();

export const SLOT_COUNT = ROSTER_SLOTS.length;
export const FIRST_SLOT_COL = "B";
export const LAST_SLOT_COL = ROSTER_SLOTS[ROSTER_SLOTS.length - 1].col;
export const CLASH_COL = colLetter(SLOT_COUNT + 2);
export const NOTES_COL = colLetter(SLOT_COUNT + 3);
export const DETAIL_COL = colLetter(SLOT_COUNT + 4);
export const HEADER_ROWS = 2;
export const FIRST_DATA_ROW = HEADER_ROWS + 1;

/** Ordered, de-duplicated list of serving areas in grid order. */
export const ROSTER_AREAS: string[] = Array.from(
  new Set(ROSTER_SLOTS.map((s) => s.area)),
);

export function headerRows(): string[][] {
  const areaRow = ["DATE", ...ROSTER_SLOTS.map((s) => s.area), "Clash Alert", "NOTES", "DETAIL"];
  const roleRow = ["", ...ROSTER_SLOTS.map((s) => s.role), "", "", ""];
  return [areaRow, roleRow];
}

/**
 * Google Sheets clash formula for a data row — flags any person appearing in
 * more than one slot on that date and names the slots they clash in.
 * NOTE: COUNTIF / IF over a range only expand elementwise inside ARRAYFORMULA;
 * without it the whole check collapses to a single value and never fires.
 */
export function clashFormula(row: number): string {
  const R = `$${FIRST_SLOT_COL}${row}:$${LAST_SLOT_COL}${row}`;
  const A = `$${FIRST_SLOT_COL}$1:$${LAST_SLOT_COL}$1`;
  const H2 = `$${FIRST_SLOT_COL}$2:$${LAST_SLOT_COL}$2`;
  const EXA = `'${ALLOWED_CLASHES_TAB}'!$A$2:$A`;
  const EXB = `'${ALLOWED_CLASHES_TAB}'!$B$2:$B`;
  return (
    `=IFERROR(LET(` +
    `r,ARRAYFORMULA(TRIM(${R})),` +
    `a,ARRAYFORMULA(TRIM(${A})),` +
    `h,ARRAYFORMULA(TRIM(${A})&IF(${H2}="",""," — "&${H2})),` +
    `ex,IFERROR(TOCOL(ARRAYFORMULA(IF(TRIM(${EXA})="",NA(),LOWER(TRIM(${EXA})&"||"&TRIM(${EXB})&"~"&TRIM(${EXB})&"||"&TRIM(${EXA})))),3),""),` +
    `names,IFERROR(UNIQUE(TOCOL(ARRAYFORMULA(IF((COUNTIF(r,r)>1)*(r<>""),r,NA())),3)),""),` +
    `msg,IF(COUNTA(names)=0,"",TEXTJOIN(" | ",TRUE,MAP(names,LAMBDA(n,LET(` +
    `ar,TOCOL(ARRAYFORMULA(IF(r=n,a,NA())),3),` +
    `sl,TOCOL(ARRAYFORMULA(IF(r=n,h,NA())),3),` +
    `k1,LOWER(INDEX(ar,1)&"||"&INDEX(ar,2)),` +
    `k2,LOWER(INDEX(sl,1)&"||"&INDEX(sl,2)),` +
    `ok,IF(COUNTA(ar)<>2,FALSE,(SUMPRODUCT(--ISNUMBER(SEARCH(k1,ex)))+SUMPRODUCT(--ISNUMBER(SEARCH(k2,ex))))>0),` +
    `IF(ok,"",n&" IN "&TEXTJOIN(" & ",TRUE,sl))))))),` +
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

export function slotByLabel(label: string): SlotDef | undefined {
  return ROSTER_SLOTS.find((s) => s.label === label);
}
