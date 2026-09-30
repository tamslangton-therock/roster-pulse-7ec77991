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
}

export function recordFromTabValues(t: UserAccessTabValues): UserAccessRecord {
  const split = (s: string | undefined) =>
    (s ?? "")
      .split(/[|;]/)
      .map((x) => x.trim())
      .filter(Boolean);
  return {
    username: t.username ?? "",
    password: t.password ?? "",
    displayName: t.display_name ?? "",
    rosterViewAreas: split(t.roster_view_areas),
    rosterEditAreas: split(t.roster_edit_areas),
    canViewHealth: (t.can_view_health ?? "").toUpperCase() === "TRUE",
    teamEditAreas: split(t.team_edit_areas),
    individualsAccess:
      t.individuals_access === "edit" || t.individuals_access === "view"
        ? t.individuals_access
        : "none",
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
  };
}

const norm = (s: string) => (s ?? "").trim().toLowerCase();

function inScope(areas: string[], area: string): boolean {
  return areas.some((a) => norm(a) === norm(area));
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

export function canViewHealth(isMaster: boolean, user: SessionUser | null): boolean {
  return isMaster || !!user?.canViewHealth;
}

export function canViewIndividuals(isMaster: boolean, user: SessionUser | null): boolean {
  return isMaster || (!!user && user.individualsAccess !== "none");
}

export function canEditIndividuals(isMaster: boolean, user: SessionUser | null): boolean {
  return isMaster || (!!user && user.individualsAccess === "edit");
}
