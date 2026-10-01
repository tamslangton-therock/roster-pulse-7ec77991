// User access model — shared by the login gate, the User Access admin page and
// every page that needs to check what the signed-in team leader may do.
// A signed-in "master" (admin access code) bypasses every check.
import type { SlotDef } from "./roster-grid";
import type { UserAccessTabValues } from "./sheets-config";

export type IndividualsAccess = "none" | "view" | "edit";

export interface UserAccessRecord {
  username: string;
  password: string;
  displayName: string;
  /** Serving areas this user can see on the Live Roster. Empty = all areas. */
  rosterViewAreas: string[];
  /** Serving areas this user may edit on the Live Roster. Empty = no editing. */
  rosterEditAreas: string[];
  canViewHealth: boolean;
  /** Serving areas this user may edit in Team Builder. Empty = no editing. */
  teamEditAreas: string[];
  individualsAccess: IndividualsAccess;
  canViewRoster: boolean;
  canViewLifeGroups: boolean;
  /** Serving areas shown on Team Health. Empty = all areas. */
  healthViewAreas: string[];
  /** Serving areas visible on the Family tab. Empty = all areas. */
  individualsViewAreas: string[];
  discipleshipAccess: IndividualsAccess;
  /** Interests whose Discipleship cards this login may see. Empty = all. */
  discipleshipInterests: string[];
}

/** What the login flow stores in the session — never includes the password. */
export interface SessionUser {
  username: string;
  displayName: string;
  rosterViewAreas: string[];
  rosterEditAreas: string[];
  canViewHealth: boolean;
  teamEditAreas: string[];
  individualsAccess: IndividualsAccess;
  canViewRoster: boolean;
  canViewLifeGroups: boolean;
  healthViewAreas: string[];
  individualsViewAreas: string[];
  discipleshipAccess: IndividualsAccess;
  /** Interests whose Discipleship cards this login may see. Empty = all. */
  discipleshipInterests: string[];
}

export function recordFromTabValues(t: UserAccessTabValues): UserAccessRecord {
  return {
    username: t.username ?? "",
    password: t.password ?? "",
    displayName: t.display_name ?? "",
    rosterViewAreas: t.roster_view_areas ?? [],
    rosterEditAreas: t.roster_edit_areas ?? [],
    canViewHealth: t.can_view_health === true,
    teamEditAreas: t.team_edit_areas ?? [],
    individualsAccess:
      t.individuals_access === "edit" || t.individuals_access === "view"
        ? t.individuals_access
        : "none",
    canViewRoster: t.can_view_roster !== false,
    canViewLifeGroups: t.can_view_life_groups === true,
    healthViewAreas: t.health_view_areas ?? [],
    individualsViewAreas: t.individuals_view_areas ?? [],
    discipleshipAccess:
      t.discipleship_access === "edit" || t.discipleship_access === "view"
        ? t.discipleship_access
        : "none",
    discipleshipInterests: t.discipleship_interests ?? [],
  };
}

export function toSessionUser(r: UserAccessRecord): SessionUser {
  return {
    username: r.username,
    displayName: r.displayName || r.username,
    rosterViewAreas: r.rosterViewAreas,
    rosterEditAreas: r.rosterEditAreas,
    canViewHealth: r.canViewHealth,
    teamEditAreas: r.teamEditAreas,
    individualsAccess: r.individualsAccess,
    canViewRoster: r.canViewRoster,
    canViewLifeGroups: r.canViewLifeGroups,
    healthViewAreas: r.healthViewAreas,
    individualsViewAreas: r.individualsViewAreas,
    discipleshipAccess: r.discipleshipAccess,
    discipleshipInterests: r.discipleshipInterests,
  };
}

const norm = (s: string) => (s ?? "").trim().toLowerCase();

/** Loose key: "Kids — Yellow 8AM" → "yellow", "Yellow Group" → "yellow". */
const areaKey = (s: string) =>
  ` ${norm(s)
    .replace(/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/g, " ")
    .replace(/\b(kids|group)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;

/** Whether a person's serving area (e.g. "Kids — Yellow 8AM") falls under a scope area (e.g. "Yellow Group"). */
export function areaMatches(scopeArea: string, servingArea: string): boolean {
  if (norm(scopeArea) === norm(servingArea)) return true;
  const s = areaKey(scopeArea);
  return s.trim() !== "" && areaKey(servingArea).includes(s);
}

export function areaInScope(areas: string[], area: string): boolean {
  return areas.some((a) => areaMatches(a, area));
}

function inScope(areas: string[], area: string): boolean {
  return areaInScope(areas, area);
}

// ---- Permission checks. `isMaster` true → always allowed. ----

export function canViewArea(isMaster: boolean, user: SessionUser | null, area: string): boolean {
  if (isMaster || !user) return true;
  if (user.rosterViewAreas.length === 0) return true;
  return inScope(user.rosterViewAreas, area);
}

export function canEditSlotLabel(
  isMaster: boolean,
  user: SessionUser | null,
  slotLabel: string,
  slots: SlotDef[],
): boolean {
  if (isMaster) return true;
  if (!user) return false;
  const slot = slots.find((s) => s.label === slotLabel);
  if (!slot) return false;
  return inScope(user.rosterEditAreas, slot.area);
}

export function canEditArea(isMaster: boolean, user: SessionUser | null, area: string): boolean {
  if (isMaster) return true;
  if (!user) return false;
  return inScope(user.rosterEditAreas, area);
}

export function canEditTeamsArea(isMaster: boolean, user: SessionUser | null, area: string): boolean {
  if (isMaster) return true;
  if (!user) return false;
  return inScope(user.teamEditAreas, area);
}

/** Whether the Live Roster page is open to this login at all. */
export function canViewRosterPage(isMaster: boolean, user: SessionUser | null): boolean {
  return isMaster || (!!user && user.canViewRoster);
}

/** Whether the Life Groups page is open to this login at all. */
export function canViewLifeGroups(isMaster: boolean, user: SessionUser | null): boolean {
  return isMaster || (!!user && user.canViewLifeGroups);
}

export function canViewHealth(isMaster: boolean, user: SessionUser | null): boolean {
  return isMaster || !!user?.canViewHealth;
}

/** Serving areas this login may see on Team Health. Empty = all areas. */
export function healthViewAreas(isMaster: boolean, user: SessionUser | null): string[] {
  if (isMaster || !user) return [];
  return user.healthViewAreas;
}

/** Serving areas this login may see on the Family tab. Empty = all areas. */
export function individualsViewAreas(isMaster: boolean, user: SessionUser | null): string[] {
  if (isMaster || !user) return [];
  return user.individualsViewAreas ?? [];
}

/** Whether a person (by serving areas) falls inside the login's Family scope. */
export function inIndividualsScope(isMaster: boolean, user: SessionUser | null, servingAreas: string[] | undefined): boolean {
  const scope = individualsViewAreas(isMaster, user);
  if (scope.length === 0) return true;
  return (servingAreas ?? []).some((a) => inScope(scope, a));
}

export function canViewIndividuals(isMaster: boolean, user: SessionUser | null): boolean {
  return isMaster || (!!user && user.individualsAccess !== "none");
}

export function canEditIndividuals(isMaster: boolean, user: SessionUser | null): boolean {
  return isMaster || (!!user && user.individualsAccess === "edit");
}

export function canViewDiscipleship(isMaster: boolean, user: SessionUser | null): boolean {
  return isMaster || (!!user && (user.discipleshipAccess ?? "none") !== "none");
}

export function canEditDiscipleship(isMaster: boolean, user: SessionUser | null): boolean {
  return isMaster || (!!user && user.discipleshipAccess === "edit");
}

/** Interests this login may see in Discipleship. Empty = all interests. */
export function discipleshipInterestScope(isMaster: boolean, user: SessionUser | null): string[] {
  if (isMaster || !user) return [];
  return user.discipleshipInterests ?? [];
}

/** Whether a connect card's interests intersect the login's interest scope. */
export function cardInInterestScope(
  isMaster: boolean,
  user: SessionUser | null,
  cardInterests: string[] | undefined,
): boolean {
  const scope = discipleshipInterestScope(isMaster, user);
  if (scope.length === 0) return true;
  return (cardInterests ?? []).some((i) => scope.includes(i));
}
