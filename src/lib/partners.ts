import type { Assignment, Volunteer } from "./types";
import type { SlotDef } from "./roster-grid";

/**
 * Family / partner alignment.
 *
 * Partners are linked on the Volunteers sheet via the `partners` column. The
 * house rule is that linked people always serve on the same Sunday, so these
 * helpers surface *splits* (one partner rostered, the other not) and suggest
 * where the missing partner could slot in. Nothing here ever auto-assigns —
 * it's advisory, the roster owner clicks to apply.
 */

const low = (s: string) => s.trim().toLowerCase();

/** lower-cased name -> canonical display names of their linked partners. */
export type PartnerIndex = Map<string, string[]>;

export function buildPartnerIndex(volunteers: Volunteer[]): PartnerIndex {
  // Canonical casing lookup so "lelo" and "Lelo" resolve to one display name.
  const canonical = new Map<string, string>();
  for (const v of volunteers) {
    if (v.full_name?.trim()) canonical.set(low(v.full_name), v.full_name.trim());
  }
  const display = (n: string) => canonical.get(low(n)) ?? n.trim();

  const pairs = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!a || !b || low(a) === low(b)) return;
    if (!pairs.has(low(a))) pairs.set(low(a), new Set());
    pairs.get(low(a))!.add(display(b));
  };

  for (const v of volunteers) {
    if (!v.full_name?.trim()) continue;
    for (const p of v.partners ?? []) {
      if (!p?.trim()) continue;
      // Links are symmetric even when only one side records them.
      link(v.full_name, p);
      link(p, v.full_name);
    }
  }

  const out: PartnerIndex = new Map();
  for (const [k, set] of pairs) out.set(k, Array.from(set).sort());
  return out;
}

/**
 * `${date}||${lowerName}` -> partner names who are NOT rostered that date.
 * Only rostered people produce entries, so an entirely absent couple is fine.
 */
export function partnerGapsByDate(
  assignments: Assignment[],
  index: PartnerIndex,
): Map<string, string[]> {
  const gaps = new Map<string, string[]>();
  if (index.size === 0) return gaps;

  const byDate = new Map<string, Set<string>>();
  for (const a of assignments) {
    if (!a.person_name?.trim()) continue;
    if (!byDate.has(a.date)) byDate.set(a.date, new Set());
    byDate.get(a.date)!.add(low(a.person_name));
  }

  for (const [date, people] of byDate) {
    for (const person of people) {
      const partners = index.get(person);
      if (!partners?.length) continue;
      const missing = partners.filter((p) => !people.has(low(p)));
      if (missing.length) gaps.set(`${date}||${person}`, missing);
    }
  }
  return gaps;
}

/** Partners of `person` who are still rostered on `date` (used on removal). */
export function partnersStillRostered(
  person: string,
  date: string,
  assignments: Assignment[],
  index: PartnerIndex,
): Assignment[] {
  const partners = index.get(low(person));
  if (!partners?.length) return [];
  const wanted = new Set(partners.map(low));
  return assignments.filter(
    (a) => a.date === date && wanted.has(low(a.person_name)),
  );
}

export interface PartnerSlotSuggestion {
  label: string;
  area: string;
  /** Slot in one of the partner's own serving areas. */
  preferred: boolean;
}

export interface PartnerSuggestion {
  partner: string;
  volunteer?: Volunteer;
  blockedOut: boolean;
  paused: boolean;
  slots: PartnerSlotSuggestion[];
}

/**
 * Open slots on `date` the missing partner could take, preferring their own
 * serving areas (and their priority area first).
 */
export function suggestSlotsForPartner(
  partner: string,
  date: string,
  opts: {
    slots: SlotDef[] | Array<{ area: string; label: string }>;
    assignments: Assignment[];
    volunteers: Volunteer[];
    blockoutDates?: Set<string>;
  },
): PartnerSuggestion {
  const { slots, assignments, volunteers, blockoutDates } = opts;
  const volunteer = volunteers.find((v) => low(v.full_name) === low(partner));

  const taken = new Set(
    assignments.filter((a) => a.date === date).map((a) => a.label),
  );
  const areas = new Set((volunteer?.serving_areas ?? []).map(low));
  const priority = low(volunteer?.priority_area ?? "");

  const open = slots
    .filter((s) => !taken.has(s.label))
    .map((s) => ({
      label: s.label,
      area: s.area,
      preferred: areas.size === 0 || areas.has(low(s.area)),
    }));

  open.sort((a, b) => {
    if (a.preferred !== b.preferred) return a.preferred ? -1 : 1;
    const ap = low(a.area) === priority ? 0 : 1;
    const bp = low(b.area) === priority ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return a.label.localeCompare(b.label);
  });

  return {
    partner,
    volunteer,
    blockedOut: blockoutDates?.has(date) ?? false,
    paused: volunteer?.is_paused ?? false,
    slots: open,
  };
}
