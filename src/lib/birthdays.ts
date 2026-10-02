// Birthday reminders — figures out whose birthdays are coming up in the next
// week and which of them the signed-in leader actually oversees (serving-area
// scope, life-group membership, or everything for the admin/master login).
import type { Volunteer } from "./types";
import type { SessionUser } from "./user-access";
import { areaMatches, areaInScope } from "./user-access";
import type { LifeGroupRow } from "./sheets.functions";

export interface BirthdayReminder {
  person: Volunteer;
  /** Days from today until the birthday (0 = today). */
  inDays: number;
  /** Next occurrence date, ISO YYYY-MM-DD. */
  nextDate: string;
  /** Why this leader is being told — serving areas in their scope, group names. */
  reasons: string[];
}

/** Parses "1993-07-14", "14/07/1993", "14 Jul" etc. → month (1-12) + day. */
export function parseBirthday(raw?: string): { month: number; day: number } | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return { month: Number(m[2]), day: Number(m[3]) };
  m = s.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?$/); // dd/mm/yyyy or dd/mm
  if (m) return { month: Number(m[2]), day: Number(m[1]) };
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return { month: d.getMonth() + 1, day: d.getDate() };
  return null;
}

/** Days from today until the next occurrence of this birthday (0 = today). */
export function daysUntilBirthday(birthday: string, today = new Date()): number | null {
  const b = parseBirthday(birthday);
  if (!b) return null;
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const t = start(today);
  let next = new Date(t.getFullYear(), b.month - 1, b.day);
  if (next.getTime() < t.getTime()) next = new Date(t.getFullYear() + 1, b.month - 1, b.day);
  return Math.round((next.getTime() - t.getTime()) / 86_400_000);
}

/** ISO date of the next occurrence. */
function nextOccurrenceIso(birthday: string, today = new Date()): string | null {
  const b = parseBirthday(birthday);
  if (!b) return null;
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let next = new Date(t.getFullYear(), b.month - 1, b.day);
  if (next.getTime() < t.getTime()) next = new Date(t.getFullYear() + 1, b.month - 1, b.day);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
}

/** "Today" · "Tomorrow" · "Saturday 3 Oct" for the reminder card. */
export function birthdayLabel(inDays: number, nextDate: string): string {
  if (inDays === 0) return "Today 🎉";
  if (inDays === 1) return "Tomorrow";
  const d = new Date(`${nextDate}T00:00:00`);
  return d.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "short" });
}

/** Prefilled WhatsApp birthday greeting. */
export function whatsappBirthdayUrl(name: string, phone?: string): string {
  const first = name.trim().split(/\s+/)[0];
  const text = encodeURIComponent(
    `Hi ${first}, wishing you a very blessed and happy birthday! 🎉🎂 Hope you have a wonderful and special day ahead!`,
  );
  const digits = (phone ?? "").replace(/[^\d+]/g, "").replace(/^\+/, "");
  return digits ? `https://wa.me/${digits}?text=${text}` : "";
}

/**
 * Every birthday within `withinDays` that this leader oversees.
 * Master logins see everyone. Leaders see a person when the person serves in
 * one of their scoped areas, or (when they have Life Group access) belongs to
 * a life group.
 */
export function upcomingBirthdays(opts: {
  volunteers: Volunteer[];
  lifeGroups: LifeGroupRow[];
  isMaster: boolean;
  user: SessionUser | null;
  withinDays?: number;
  today?: Date;
}): BirthdayReminder[] {
  const { volunteers, lifeGroups, isMaster, user, withinDays = 7, today = new Date() } = opts;

  // Serving-area scope: union of every area scope on the login.
  const scopeAreas = isMaster || !user
    ? []
    : Array.from(
        new Set([
          ...(user.rosterViewAreas ?? []),
          ...(user.healthViewAreas ?? []),
          ...(user.individualsViewAreas ?? []),
          ...(user.teamEditAreas ?? []),
        ]),
      ).filter(Boolean);

  // Life-group membership this login can see: named leader of a group, or any
  // group at all when the login has Life Group access.
  const leaderKey = user ? `${user.displayName} ${user.username}`.toLowerCase() : "";
  const visibleGroups = lifeGroups.filter((g) => {
    if (isMaster) return true;
    if (!user) return false;
    if (user.canViewLifeGroups) return true;
    const leaders = (g.Leaders ?? "").toLowerCase();
    return leaderKey.split(/\s+/).filter(Boolean).some((w) => w.length > 2 && leaders.includes(w));
  });

  const reminders: BirthdayReminder[] = [];
  for (const person of volunteers) {
    if (!person.birthday) continue;
    const inDays = daysUntilBirthday(person.birthday, today);
    if (inDays === null || inDays > withinDays) continue;
    const nextDate = nextOccurrenceIso(person.birthday, today);
    if (!nextDate) continue;

    const reasons: string[] = [];
    if (isMaster) {
      reasons.push(...(person.serving_areas ?? []));
    } else if (user) {
      const matched = (person.serving_areas ?? []).filter((a) =>
        scopeAreas.length > 0 ? areaInScope(scopeAreas, a) : false,
      );
      reasons.push(...matched);
      const groups = visibleGroups
        .filter((g) => g.MembersList.some((m) => m.trim().toLowerCase() === person.full_name.trim().toLowerCase()))
        .map((g) => g.GroupName);
      reasons.push(...groups);
    }
    if (reasons.length === 0) continue;

    reminders.push({ person, inDays, nextDate, reasons });
  }

  reminders.sort((a, b) => a.inDays - b.inDays || a.person.full_name.localeCompare(b.person.full_name));
  return reminders;
}

export { areaMatches };
