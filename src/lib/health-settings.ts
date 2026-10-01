import type { Assignment, FatigueStatus, Volunteer } from "./types";

export type HealthMode =
  | "preference" // vs each person's own frequency preference / max per month
  | "past" // how many times served in the last N weeks
  | "future" // how many times rostered in the next N weeks
  | "range" // custom date range (e.g. a set of months)
  | "consecutive"; // consecutive-week streaks

export interface HealthSettings {
  mode: HealthMode;
  pastWeeks: number;
  futureWeeks: number;
  rangeStart: string; // ISO yyyy-mm-dd
  rangeEnd: string; // ISO yyyy-mm-dd
  /** count >= this is treated as over-served (red) in count modes */
  highThreshold: number;
  /** count <= this is treated as under-used (yellow) in count modes */
  lowThreshold: number;
  /** streak >= this is burnout risk */
  burnoutStreak: number;
  /** streak == this is "no rest weeks" */
  noRestStreak: number;
  /** % tolerance above a person's target before flagging over-serving */
  tolerancePct: number;
  area: string; // "all" or a serving area
  includePaused: boolean;
}

const DAY = 24 * 60 * 60 * 1000;

export const DEFAULT_HEALTH_SETTINGS: HealthSettings = {
  mode: "consecutive",
  pastWeeks: 4,
  futureWeeks: 4,
  rangeStart: "",
  rangeEnd: "",
  highThreshold: 4,
  lowThreshold: 1,
  burnoutStreak: 3,
  noRestStreak: 2,
  tolerancePct: 0,
  area: "all",
  includePaused: false,
};

const STORAGE_KEY = "roster-pulse:health-settings";

/** Master-configurable label + emoji per health status (edited in User Access). */
export interface HealthLabels {
  healthy: { label: string; emoji: string };
  could_do_more: { label: string; emoji: string };
  no_rest: { label: string; emoji: string };
  burnout: { label: string; emoji: string };
  paused: { label: string; emoji: string };
  inactive: { label: string; emoji: string };
}

export type HealthLabelKey = keyof HealthLabels;

export const DEFAULT_HEALTH_LABELS: HealthLabels = {
  healthy: { label: "Healthy", emoji: "🍏" },
  could_do_more: { label: "Could do more", emoji: "⚠️" },
  no_rest: { label: "No rest weeks", emoji: "⚠️" },
  burnout: { label: "Burnout risk", emoji: "🚨" },
  paused: { label: "Paused", emoji: "⏸️" },
  inactive: { label: "Inactive", emoji: "💤" },
};

/** The statuses whose labels can be renamed in the Health Rules settings. */
export const LABEL_STATUSES: HealthLabelKey[] = [
  "healthy",
  "could_do_more",
  "no_rest",
  "burnout",
  "paused",
  "inactive",
];

/** Merge partial/parsed label data over the defaults. */
export function mergeHealthLabels(raw: unknown): HealthLabels {
  const src = (raw ?? {}) as Partial<Record<HealthLabelKey, { label?: unknown; emoji?: unknown }>>;
  const out = { ...DEFAULT_HEALTH_LABELS } as HealthLabels;
  for (const key of LABEL_STATUSES) {
    const entry = src[key];
    if (!entry) continue;
    const label = typeof entry.label === "string" ? entry.label.trim() : "";
    const emoji = typeof entry.emoji === "string" ? entry.emoji.trim() : "";
    out[key] = {
      label: label || DEFAULT_HEALTH_LABELS[key].label,
      emoji: emoji || DEFAULT_HEALTH_LABELS[key].emoji,
    };
  }
  return out;
}

/** statusMeta with master-configurable labels; falls back to built-in defaults. */
export function statusMetaWith(
  labels: HealthLabels | undefined,
  s: FatigueStatus,
): { label: string; emoji: string; tone: "green" | "yellow" | "amber" | "red" | "blue" | "slate" } {
  const tones = {
    healthy: "green",
    could_do_more: "yellow",
    no_rest: "amber",
    burnout: "red",
    paused: "blue",
    inactive: "slate",
  } as const;
  const tone = tones[s];
  const custom = labels?.[s];
  if (custom) return { label: custom.label, emoji: custom.emoji, tone };
  const fallback = {
    healthy: { label: "Healthy", emoji: "🍏" },
    could_do_more: { label: "Could do more", emoji: "⚠️" },
    no_rest: { label: "No rest weeks", emoji: "⚠️" },
    burnout: { label: "Burnout risk", emoji: "🚨" },
    paused: { label: "Paused", emoji: "⏸️" },
    inactive: { label: "Inactive", emoji: "💤" },
  }[s];
  return { ...fallback, tone };
}

/** Flatten settings + labels into key/value rows for the Health_Config tab. */
export function healthConfigRows(
  s: HealthSettings,
  labels: HealthLabels,
): Record<string, string> {
  const rows: Record<string, string> = {
    mode: s.mode,
    pastWeeks: String(s.pastWeeks),
    futureWeeks: String(s.futureWeeks),
    rangeStart: s.rangeStart,
    rangeEnd: s.rangeEnd,
    highThreshold: String(s.highThreshold),
    lowThreshold: String(s.lowThreshold),
    burnoutStreak: String(s.burnoutStreak),
    noRestStreak: String(s.noRestStreak),
    tolerancePct: String(s.tolerancePct),
    area: s.area,
    includePaused: s.includePaused ? "TRUE" : "FALSE",
  };
  for (const key of LABEL_STATUSES) {
    rows[`label_${key}`] = labels[key].label;
    rows[`emoji_${key}`] = labels[key].emoji;
  }
  return rows;
}

/** Parse key/value rows from the Health_Config tab into settings + labels. */
export function parseHealthConfig(
  rows: Record<string, string>,
): { settings: HealthSettings; labels: HealthLabels } {
  const s: HealthSettings = { ...DEFAULT_HEALTH_SETTINGS };
  const num = (key: keyof HealthSettings, min: number) => {
    const raw = rows[key as string];
    if (raw === undefined || raw === "") return;
    const n = Number(raw);
    if (Number.isFinite(n)) (s[key] as number) = Math.max(min, n);
  };
  if (rows.mode && ["preference", "past", "future", "range", "consecutive"].includes(rows.mode)) {
    s.mode = rows.mode as HealthMode;
  }
  num("pastWeeks", 1);
  num("futureWeeks", 1);
  num("highThreshold", 1);
  num("lowThreshold", 0);
  num("burnoutStreak", 2);
  num("noRestStreak", 1);
  num("tolerancePct", 0);
  if (rows.rangeStart !== undefined) s.rangeStart = rows.rangeStart;
  if (rows.rangeEnd !== undefined) s.rangeEnd = rows.rangeEnd;
  if (rows.area) s.area = rows.area;
  if (rows.includePaused) s.includePaused = /^(true|1|yes)$/i.test(rows.includePaused);
  const labelRaw: Record<string, { label?: string; emoji?: string }> = {};
  for (const key of LABEL_STATUSES) {
    const label = rows[`label_${key}`];
    const emoji = rows[`emoji_${key}`];
    if (label !== undefined || emoji !== undefined) {
      labelRaw[key] = { label, emoji };
    }
  }
  return { settings: s, labels: mergeHealthLabels(labelRaw) };
}


export function loadHealthSettings(): HealthSettings {
  if (typeof window === "undefined") return DEFAULT_HEALTH_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_HEALTH_SETTINGS;
    return { ...DEFAULT_HEALTH_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_HEALTH_SETTINGS;
  }
}

export function saveHealthSettings(s: HealthSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Convert a free-text frequency preference into serves-per-month. */
export function targetPerMonth(v: Volunteer): number {
  const p = (v.frequency_preference || "").toLowerCase();
  if (p.includes("week") && !p.includes("fortnight") && !p.includes("bi")) return 4;
  if (p.includes("fortnight") || p.includes("2 week") || p.includes("bi-week")) return 2;
  const m = p.match(/(\d+)\s*x?\s*(?:per|\/)?\s*month/);
  if (m) return parseInt(m[1], 10);
  if (p.includes("month")) {
    const n = p.match(/(\d+)/);
    if (n) return parseInt(n[1], 10);
    return 1;
  }
  return v.max_serving_per_month || 1;
}

export interface HealthRow {
  volunteer: Volunteer;
  status: FatigueStatus;
  /** primary count for the active lens */
  count: number;
  target: number;
  streak: number;
  windowLabel: string;
  detail: string;
}

function servedDates(v: Volunteer, assignments: Assignment[]): Date[] {
  const name = v.full_name.toLowerCase();
  return assignments
    .filter((a) => a.person_name.toLowerCase() === name)
    .map((a) => new Date(a.date + "T00:00:00"))
    .sort((a, b) => a.getTime() - b.getTime());
}

function maxStreak(dates: Date[]): number {
  const set = new Set(dates.map((d) => d.toISOString().slice(0, 10)));
  let best = 0;
  for (const d of dates) {
    let run = 1;
    let cur = d;
    while (set.has(new Date(cur.getTime() + 7 * DAY).toISOString().slice(0, 10))) {
      run++;
      cur = new Date(cur.getTime() + 7 * DAY);
    }
    if (run > best) best = run;
  }
  return best;
}

/** Compute a health row for a volunteer using the configured lens. */
export function computeHealthRow(
  v: Volunteer,
  assignments: Assignment[],
  s: HealthSettings,
  today: Date = new Date(),
): HealthRow {
  const all = servedDates(v, assignments);
  const streak = maxStreak(all);
  const target = targetPerMonth(v);
  const t0 = new Date(today.toDateString()).getTime();

  if (v.is_paused) {
    return {
      volunteer: v,
      status: "paused",
      count: 0,
      target,
      streak,
      windowLabel: "Paused",
      detail: "Serving paused",
    };
  }

  let count = 0;
  let windowLabel = "";
  let months = 1;

  if (s.mode === "past") {
    const from = t0 - s.pastWeeks * 7 * DAY;
    count = all.filter((d) => d.getTime() >= from && d.getTime() <= t0).length;
    windowLabel = `Last ${s.pastWeeks}w`;
    months = s.pastWeeks / 4.345;
  } else if (s.mode === "future") {
    const to = t0 + s.futureWeeks * 7 * DAY;
    count = all.filter((d) => d.getTime() >= t0 && d.getTime() <= to).length;
    windowLabel = `Next ${s.futureWeeks}w`;
    months = s.futureWeeks / 4.345;
  } else if (s.mode === "range") {
    const from = s.rangeStart ? new Date(s.rangeStart + "T00:00:00").getTime() : -Infinity;
    const to = s.rangeEnd ? new Date(s.rangeEnd + "T23:59:59").getTime() : Infinity;
    count = all.filter((d) => d.getTime() >= from && d.getTime() <= to).length;
    windowLabel =
      s.rangeStart || s.rangeEnd ? `${s.rangeStart || "…"} → ${s.rangeEnd || "…"}` : "All dates";
    months =
      isFinite(from) && isFinite(to) ? Math.max(0.5, (to - from) / (30.44 * DAY)) : 1;
  } else if (s.mode === "preference") {
    // rolling 4 weeks around today, compared to their own stated frequency
    const from = t0 - 28 * DAY;
    count = all.filter((d) => d.getTime() >= from && d.getTime() <= t0 + 28 * DAY).length;
    windowLabel = "±4w vs preference";
    months = 2;
  } else {
    count = all.filter((d) => Math.abs(d.getTime() - t0) <= 28 * DAY).length;
    windowLabel = "Streak";
  }

  let status: FatigueStatus = "healthy";
  let detail = "";

  if (s.mode === "consecutive") {
    if (streak >= s.burnoutStreak) {
      status = "burnout";
      detail = `${streak} weeks in a row`;
    } else if (streak === s.noRestStreak) {
      status = "no_rest";
      detail = `${streak} weeks in a row`;
    } else if (all.length === 0) {
      status = "inactive";
      detail = "Never rostered";
    } else {
      detail = streak > 1 ? `${streak} weeks in a row` : "No back-to-back weeks";
    }
  } else if (s.mode === "preference") {
    const allowed = target * months * (1 + s.tolerancePct / 100);
    const expected = target * months;
    if (count === 0) {
      status = "inactive";
      detail = `Wants ~${target}/month, rostered 0`;
    } else if (count > allowed) {
      status = "burnout";
      detail = `${count} vs ~${expected.toFixed(0)} requested`;
    } else if (count < expected * 0.6) {
      status = "could_do_more";
      detail = `${count} vs ~${expected.toFixed(0)} requested`;
    } else {
      detail = `${count} vs ~${expected.toFixed(0)} requested — on target`;
    }
    if (status === "healthy" && streak >= s.burnoutStreak) {
      status = "no_rest";
      detail += ` · ${streak}w streak`;
    }
  } else {
    if (count === 0) {
      status = "inactive";
      detail = `0 in ${windowLabel.toLowerCase()}`;
    } else if (count >= s.highThreshold) {
      status = "burnout";
      detail = `${count} in ${windowLabel.toLowerCase()}`;
    } else if (count <= s.lowThreshold) {
      status = "could_do_more";
      detail = `${count} in ${windowLabel.toLowerCase()}`;
    } else {
      detail = `${count} in ${windowLabel.toLowerCase()}`;
    }
    if (status === "healthy" && streak >= s.burnoutStreak) {
      status = "no_rest";
      detail += ` · ${streak}w streak`;
    }
  }

  return { volunteer: v, status, count, target, streak, windowLabel, detail };
}

export const MODE_OPTIONS: { value: HealthMode; label: string; hint: string }[] = [
  {
    value: "preference",
    label: "Against their preference",
    hint: "Compares each person's roster load to the frequency they asked for.",
  },
  { value: "past", label: "Served in last N weeks", hint: "Backwards-looking load." },
  { value: "future", label: "Rostered in next N weeks", hint: "Forward-looking load." },
  { value: "range", label: "Custom date range / months", hint: "Pick any start and end date." },
  { value: "consecutive", label: "Consecutive weeks", hint: "Back-to-back serving streaks." },
];
