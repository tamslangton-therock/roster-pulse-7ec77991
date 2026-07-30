import type { Assignment, FatigueStatus, Volunteer } from "./types";
import { findVolunteer } from "./store";

export interface Clash {
  date: string;
  person: string;
  assignment_ids: string[];
  is_override: boolean;
}

/**
 * Allowed-clash exceptions: pairs of serving areas (or full "Area — Role"
 * slot labels) a person MAY hold on the same date. Anything not listed clashes.
 */
export interface AllowedPair {
  area_a: string;
  area_b: string;
}

const norm = (s: string) => s.trim().toLowerCase();

export function buildAllowedSet(pairs: AllowedPair[] = []): Set<string> {
  const set = new Set<string>();
  for (const p of pairs) {
    const a = norm(p.area_a);
    const b = norm(p.area_b);
    if (!a || !b) continue;
    set.add(`${a}||${b}`);
    set.add(`${b}||${a}`);
  }
  return set;
}

/** True when these two assignments are an explicitly allowed same-day pairing. */
export function isAllowedPair(
  a: Assignment,
  b: Assignment,
  allowed: Set<string>,
): boolean {
  if (allowed.size === 0) return false;
  const keys = (x: Assignment) => [norm(x.area), norm(x.label)];
  for (const ka of keys(a)) {
    for (const kb of keys(b)) {
      if (allowed.has(`${ka}||${kb}`)) return true;
    }
  }
  return false;
}

/** True when every pairing in the group is explicitly allowed. */
export function groupAllowed(list: Assignment[], allowed: Set<string>): boolean {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (!isAllowedPair(list[i], list[j], allowed)) return false;
    }
  }
  return true;
}

export function detectClashes(
  assignments: Assignment[],
  allowed: Set<string> = new Set(),
): Clash[] {
  const map = new Map<string, Assignment[]>();
  for (const a of assignments) {
    const key = `${a.date}||${a.person_name.toLowerCase()}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(a);
  }
  const clashes: Clash[] = [];
  for (const [key, list] of map) {
    if (list.length > 1 && !groupAllowed(list, allowed)) {
      const [date] = key.split("||");
      clashes.push({
        date,
        person: list[0].person_name,
        assignment_ids: list.map((a) => a.id),
        is_override: list.every((a) => a.is_override),
      });
    }
  }
  return clashes.sort((a, b) => a.date.localeCompare(b.date));
}

export function assignmentsByCell(
  assignments: Assignment[],
): Map<string, Assignment[]> {
  const m = new Map<string, Assignment[]>();
  for (const a of assignments) {
    const k = `${a.date}||${a.label}`;
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(a);
  }
  return m;
}

/**
 * Fatigue rules based on rolling window around a "current" date.
 * - burnout: 3+ consecutive weeks including current
 * - no_rest: serving current + next week (no rest in immediate future) OR 2 in a row
 * - could_do_more: below max_serving_per_month in current month
 * - paused: volunteer.is_paused
 * - inactive: 0 assignments in the last 8 weeks
 * - healthy: otherwise
 */
export function computeFatigue(
  volunteer: Volunteer,
  assignments: Assignment[],
  today: Date = new Date(),
): { status: FatigueStatus; last4: number; last8: number; monthCount: number; streak: number } {
  if (volunteer.is_paused) {
    return { status: "paused", last4: 0, last8: 0, monthCount: 0, streak: 0 };
  }
  const mine = assignments
    .filter((a) => a.person_name.toLowerCase() === volunteer.full_name.toLowerCase())
    .map((a) => new Date(a.date + "T00:00:00"))
    .sort((a, b) => a.getTime() - b.getTime());

  const dateSet = new Set(mine.map((d) => d.toISOString().slice(0, 10)));

  const day = 24 * 60 * 60 * 1000;
  const last4 = mine.filter((d) => Math.abs(d.getTime() - today.getTime()) <= 28 * day).length;
  const last8 = mine.filter((d) => Math.abs(d.getTime() - today.getTime()) <= 56 * day).length;

  const month = today.getMonth();
  const year = today.getFullYear();
  const monthCount = mine.filter((d) => d.getMonth() === month && d.getFullYear() === year).length;

  // Streak: count of consecutive weeks (each 7 days apart) around any date within +/-14 days of today
  // Simplified: find the max run of consecutive Sundays (7 day steps) in the set.
  let streak = 0;
  for (const d of mine) {
    let run = 1;
    let cur = d;
    while (true) {
      const next = new Date(cur.getTime() + 7 * day);
      if (dateSet.has(next.toISOString().slice(0, 10))) {
        run++;
        cur = next;
      } else break;
    }
    if (run > streak) streak = run;
  }

  let status: FatigueStatus = "healthy";
  if (streak >= 3) status = "burnout";
  else if (streak === 2) status = "no_rest";
  else if (last8 === 0) status = "inactive";
  else if (monthCount < volunteer.max_serving_per_month) status = "could_do_more";

  return { status, last4, last8, monthCount, streak };
}

export function statusMeta(s: FatigueStatus) {
  switch (s) {
    case "healthy":
      return { label: "Healthy", emoji: "🍏", tone: "green" as const };
    case "could_do_more":
      return { label: "Could do more", emoji: "⚠️", tone: "yellow" as const };
    case "no_rest":
      return { label: "No rest weeks", emoji: "⚠️", tone: "amber" as const };
    case "burnout":
      return { label: "Burnout risk", emoji: "🚨", tone: "red" as const };
    case "paused":
      return { label: "Paused", emoji: "⏸️", tone: "blue" as const };
    case "inactive":
      return { label: "Inactive", emoji: "💤", tone: "slate" as const };
  }
}

export interface SwapCandidate {
  volunteer: Volunteer;
  score: number;
  reasons: string[];
}

export function rankSwapCandidates(
  target: Assignment,
  volunteers: Volunteer[],
  assignments: Assignment[],
): SwapCandidate[] {
  const takenSet = new Set(
    assignments
      .filter((a) => a.date === target.date)
      .map((a) => a.person_name.toLowerCase()),
  );

  const candidates: SwapCandidate[] = [];
  for (const v of volunteers) {
    if (v.is_paused) continue;
    if (v.full_name.toLowerCase() === target.person_name.toLowerCase()) continue;

    const qualified = v.serving_areas.some(
      (a) => a.toLowerCase() === target.area.toLowerCase(),
    );
    if (!qualified) continue;

    const free = !takenSet.has(v.full_name.toLowerCase());
    const fatigue = computeFatigue(v, assignments);
    const partnerServing = v.partners.some((p) => takenSet.has(p.toLowerCase()));

    let score = 0;
    const reasons: string[] = [];
    if (qualified) { score += 10; reasons.push("Qualified"); }
    if (free) { score += 8; reasons.push("Free that date"); }
    else { score -= 20; reasons.push("Already serving"); }
    if (fatigue.status === "healthy") { score += 5; reasons.push("Healthy fatigue"); }
    if (fatigue.status === "could_do_more") { score += 4; reasons.push("Could do more"); }
    if (fatigue.status === "burnout") { score -= 10; reasons.push("Burnout risk"); }
    if (fatigue.status === "no_rest") { score -= 5; reasons.push("No rest coming up"); }
    if (partnerServing) { score += 3; reasons.push("Partner already serving"); }

    candidates.push({ volunteer: v, score, reasons });
  }
  return candidates.sort((a, b) => b.score - a.score).slice(0, 12);
}

export function upcomingForPerson(
  personName: string,
  assignments: Assignment[],
  today: Date = new Date(),
) {
  return assignments
    .filter(
      (a) =>
        a.person_name.toLowerCase() === personName.toLowerCase() &&
        new Date(a.date) >= new Date(today.toDateString()),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}
