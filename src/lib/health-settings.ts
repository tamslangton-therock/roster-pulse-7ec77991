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
