import { create } from "zustand";
import type { Team, Volunteer, Assignment } from "./types";
import {
  fetchAllTabs,
  writeTab,
  fetchLiveRoster,
  writeLiveRoster,
  fetchBlockouts,
  writeBlockouts,
  type LiveRosterRow,
  type BlockoutRow,
} from "./sheets.functions";
import { ROSTER_SLOTS, defaultSundayWindow } from "./roster-grid";
import type { SheetTab } from "./sheets-config";
import { toast } from "sonner";


type SyncStatus = "idle" | "syncing" | "error";

interface RosterState {
  teams: Team[];
  volunteers: Volunteer[];
  assignments: Assignment[];
  blockouts: BlockoutRow[];


  ready: boolean;
  loading: boolean;
  error: string | null;
  syncStatus: SyncStatus;

  // Derived
  dates: string[];
  rosterMeta: Record<string, { label: string; notes: string; detail: string }>;

  // Lifecycle
  hydrate: () => Promise<void>;

  // Team Actions
  addTeam: (team_name: string, serving_area: string) => void;
  removeTeam: (id: string) => void;
  updateTeam: (id: string, updates: Partial<Team>) => void;
  updateTeamMembers: (teamId: string, memberNames: string[]) => void;

  // Volunteer Actions
  addVolunteer: (volunteer: Partial<Volunteer> & { full_name: string } & Record<string, unknown>) => void;
  removeVolunteer: (id: string) => void;
  updateVolunteer: (id: string, updates: Partial<Volunteer> & Record<string, unknown>) => void;

  // Assignment Actions
  setAssignments: (assignments: Assignment[]) => void;
  updateAssignment: (id: string, updates: Partial<Assignment>) => void;
  swapAssignment: (id: string, newPersonName: string) => void;
  removeAssignment: (id: string) => void;
  setOverride: (id: string, is_override: boolean) => void;

  // Live Roster grid
  addRosterDate: (date: string, label?: string) => void;
  removeRosterDate: (date: string) => void;
  assignSlot: (date: string, label: string, personName: string) => void;
  clearSlot: (date: string, label: string) => void;

  // Blockouts (date block-outs / unavailability) — two-way with the Blockouts tab
  toggleBlockout: (personName: string, date: string, reason?: string) => void;
}


// --------- Background sync ---------
const dirtyTimers: Partial<Record<SheetTab, ReturnType<typeof setTimeout>>> = {};
const inFlight: Partial<Record<SheetTab, boolean>> = {};

function scheduleSync(tab: SheetTab, getRows: () => Array<Record<string, unknown>>) {
  if (typeof window === "undefined") return;
  useRoster.setState({ syncStatus: "syncing" });
  if (dirtyTimers[tab]) clearTimeout(dirtyTimers[tab]!);
  dirtyTimers[tab] = setTimeout(async () => {
    if (inFlight[tab]) {
      // retry shortly after current write finishes
      scheduleSync(tab, getRows);
      return;
    }
    inFlight[tab] = true;
    try {
      await writeTab({ data: { tab, rows: getRows() } });
      useRoster.setState({ syncStatus: "idle", error: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[sheets sync] ${tab} failed`, err);
      useRoster.setState({ syncStatus: "error", error: msg });
      toast.error(`Google Sheets sync failed for ${tab}`, { description: msg.slice(0, 200) });
    } finally {
      inFlight[tab] = false;
    }
  }, 800);
}

let rosterTimer: ReturnType<typeof setTimeout> | null = null;
let rosterInFlight = false;

function scheduleRosterSync() {
  if (typeof window === "undefined") return;
  useRoster.setState({ syncStatus: "syncing" });
  if (rosterTimer) clearTimeout(rosterTimer);
  rosterTimer = setTimeout(async () => {
    if (rosterInFlight) {
      scheduleRosterSync();
      return;
    }
    rosterInFlight = true;
    try {
      await writeLiveRoster({ data: { rows: buildRosterRows(useRoster.getState()) } });
      useRoster.setState({ syncStatus: "idle", error: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[live roster sync] failed", err);
      useRoster.setState({ syncStatus: "error", error: msg });
      toast.error("Google Sheets sync failed for Live_Roster", {
        description: msg.slice(0, 200),
      });
    } finally {
      rosterInFlight = false;
    }
  }, 900);
}

let blockoutTimer: ReturnType<typeof setTimeout> | null = null;
let blockoutInFlight = false;

function scheduleBlockoutSync() {
  if (typeof window === "undefined") return;
  useRoster.setState({ syncStatus: "syncing" });
  if (blockoutTimer) clearTimeout(blockoutTimer);
  blockoutTimer = setTimeout(async () => {
    if (blockoutInFlight) {
      scheduleBlockoutSync();
      return;
    }
    blockoutInFlight = true;
    try {
      const rows = [...useRoster.getState().blockouts].sort(
        (a, b) => a.date.localeCompare(b.date) || a.person_name.localeCompare(b.person_name),
      );
      await writeBlockouts({ data: { rows } });
      useRoster.setState({ syncStatus: "idle", error: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[blockouts sync] failed", err);
      useRoster.setState({ syncStatus: "error", error: msg });
      toast.error("Google Sheets sync failed for Blockouts", {
        description: msg.slice(0, 200),
      });
    } finally {
      blockoutInFlight = false;
    }
  }, 800);
}


function buildRosterRows(state: RosterState): LiveRosterRow[] {
  return state.dates.map((date) => {
    const meta = state.rosterMeta[date] ?? { label: date, notes: "", detail: "" };
    const cells: Record<string, string> = {};
    for (const a of state.assignments) {
      if (a.date !== date || !a.person_name) continue;
      cells[a.label] = a.person_name;
    }
    return { date, label: meta.label || date, cells, notes: meta.notes, detail: meta.detail };
  });
}

function computeDates(assignments: Assignment[]): string[] {
  return Array.from(new Set(assignments.map((a) => a.date))).sort();
}

function stripVolunteer(v: Volunteer): Record<string, unknown> {
  return {
    id: v.id,
    full_name: v.full_name,
    email: v.email ?? "",
    phone: v.phone ?? "",
    serving_areas: v.serving_areas ?? [],
    partners: v.partners ?? [],
    max_serving_per_month: v.max_serving_per_month ?? 0,
    frequency_preference: v.frequency_preference ?? "",
    priority_area: v.priority_area ?? "",
    is_paused: !!v.is_paused,
    notes: v.notes ?? "",
    unavailable_dates: v.unavailable_dates ?? [],
  };
}

function stripTeam(t: Team): Record<string, unknown> {
  return {
    id: t.id,
    team_name: t.team_name,
    serving_area: t.serving_area,
    member_names: t.member_names ?? [],
  };
}

function stripAssignment(a: Assignment): Record<string, unknown> {
  return {
    id: a.id,
    date: a.date,
    area: a.area,
    role: a.role,
    label: a.label,
    person_name: a.person_name,
    team_name: a.team_name ?? "",
    is_override: !!a.is_override,
    notes: a.notes ?? "",
    status: a.status ?? "",
  };
}

export const useRoster = create<RosterState>()((set, get) => ({
  teams: [],
  volunteers: [],
  assignments: [],
  blockouts: [],


  ready: false,
  loading: false,
  error: null,
  syncStatus: "idle",

  dates: [],
  rosterMeta: {},

  hydrate: async () => {
    if (get().ready || get().loading) return;
    set({ loading: true, error: null });
    try {
      const [data, gridRows, blockouts] = await Promise.all([
        fetchAllTabs(),
        fetchLiveRoster(),
        fetchBlockouts().catch(() => [] as BlockoutRow[]),
      ]);

      const volunteers = (data.volunteers as unknown as Volunteer[]).map((v) => ({
        ...v,
        id: v.id || `vol-${Math.random().toString(36).slice(2, 10)}`,
      }));
      const teams = (data.teams as unknown as Team[]).map((t) => ({
        ...t,
        id: t.id || `team-${Math.random().toString(36).slice(2, 10)}`,
      }));

      const slotByLabel = new Map(ROSTER_SLOTS.map((s) => [s.label, s]));
      const assignments: Assignment[] = [];
      const rosterMeta: RosterState["rosterMeta"] = {};
      for (const row of gridRows) {
        rosterMeta[row.date] = {
          label: row.label || row.date,
          notes: row.notes,
          detail: row.detail,
        };
        for (const [label, person] of Object.entries(row.cells)) {
          const slot = slotByLabel.get(label);
          if (!slot || !person) continue;
          assignments.push({
            id: `${row.date}::${label}`,
            date: row.date,
            area: slot.area,
            role: slot.role || slot.area,
            label,
            person_name: person,
            is_override: false,
            notes: "",
            status: "pending",
          });
        }
      }

      let dates = Object.keys(rosterMeta).sort();
      if (dates.length === 0) {
        dates = defaultSundayWindow();
        for (const d of dates) rosterMeta[d] = { label: d, notes: "", detail: "" };
      }

      set({
        volunteers,
        teams,
        assignments,
        blockouts,
        rosterMeta,
        dates,
        ready: true,
        loading: false,
      });

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[sheets hydrate] failed", err);
      set({ loading: false, error: msg, ready: true });
      toast.error("Failed to load from Google Sheets", { description: msg.slice(0, 200) });
    }
  },

  // --- TEAMS ---
  addTeam: (team_name, serving_area) => {
    set((state) => ({
      teams: [
        ...state.teams,
        { id: `team-${Date.now()}`, team_name, serving_area, member_names: [] },
      ],
    }));
    scheduleSync("teams", () => get().teams.map(stripTeam));
  },
  removeTeam: (id) => {
    set((state) => ({ teams: state.teams.filter((t) => String(t.id) !== String(id)) }));
    scheduleSync("teams", () => get().teams.map(stripTeam));
  },
  updateTeam: (id, updates) => {
    set((state) => ({
      teams: state.teams.map((t) => (String(t.id) === String(id) ? { ...t, ...updates } : t)),
    }));
    scheduleSync("teams", () => get().teams.map(stripTeam));
  },
  updateTeamMembers: (teamId, memberNames) => {
    set((state) => ({
      teams: state.teams.map((t) =>
        String(t.id) === String(teamId) ? { ...t, member_names: memberNames } : t,
      ),
    }));
    scheduleSync("teams", () => get().teams.map(stripTeam));
  },

  // --- VOLUNTEERS ---
  addVolunteer: (volunteer) => {
    const v: Volunteer = {
      id: `vol-${Date.now()}`,
      full_name: String(volunteer.full_name ?? ""),
      email: (volunteer.email as string) ?? "",
      phone: (volunteer.phone as string) ?? "",
      serving_areas: (volunteer.serving_areas as string[]) ?? [],
      partners: (volunteer.partners as string[]) ?? [],
      max_serving_per_month: Number(
        volunteer.max_serving_per_month ?? volunteer.max_serves_per_month ?? 0,
      ),
      frequency_preference: (volunteer.frequency_preference as string) ?? "",
      priority_area: (volunteer.priority_area as string) ?? "",
      is_paused: !!volunteer.is_paused,
      notes: (volunteer.notes as string) ?? "",
      unavailable_dates: (volunteer.unavailable_dates as string[]) ?? [],
    };
    set((state) => ({ volunteers: [...state.volunteers, v] }));
    scheduleSync("volunteers", () => get().volunteers.map(stripVolunteer));
  },
  removeVolunteer: (id) => {
    set((state) => ({ volunteers: state.volunteers.filter((v) => String(v.id) !== String(id)) }));
    scheduleSync("volunteers", () => get().volunteers.map(stripVolunteer));
  },
  updateVolunteer: (id, updates) => {
    const normalized: Partial<Volunteer> = { ...updates };
    if ("max_serves_per_month" in updates && updates.max_serves_per_month !== undefined) {
      normalized.max_serving_per_month = Number(updates.max_serves_per_month);
    }
    set((state) => {
      const target = state.volunteers.find((v) => String(v.id) === String(id));
      const oldName = target?.full_name;
      const newName = normalized.full_name;

      const updatedVolunteers = state.volunteers.map((v) =>
        String(v.id) === String(id) ? { ...v, ...normalized } : v,
      );
      if (!oldName || !newName || oldName === newName) {
        return { volunteers: updatedVolunteers };
      }
      const updatedTeams = state.teams.map((team) => ({
        ...team,
        member_names: team.member_names.map((n) => (n === oldName ? newName : n)),
      }));
      const updatedAssignments = state.assignments.map((a) =>
        a.person_name === oldName ? { ...a, person_name: newName } : a,
      );
      return {
        volunteers: updatedVolunteers,
        teams: updatedTeams,
        assignments: updatedAssignments,
      };
    });
    scheduleSync("volunteers", () => get().volunteers.map(stripVolunteer));
    // Cascade: also sync teams + assignments if a rename happened
    scheduleSync("teams", () => get().teams.map(stripTeam));
    scheduleRosterSync();
  },

  // --- ASSIGNMENTS ---
  setAssignments: (assignments) => {
    set({ assignments, dates: computeDates(assignments) });
    scheduleRosterSync();
  },
  updateAssignment: (id, updates) => {
    set((state) => ({
      assignments: state.assignments.map((a) =>
        String(a.id) === String(id) ? { ...a, ...updates } : a,
      ),
    }));
    scheduleRosterSync();
  },
  swapAssignment: (id, newPersonName) => {
    set((state) => ({
      assignments: state.assignments.map((a) =>
        String(a.id) === String(id) ? { ...a, person_name: newPersonName } : a,
      ),
    }));
    scheduleRosterSync();
  },
  removeAssignment: (id) => {
    set((state) => {
      const next = state.assignments.filter((a) => String(a.id) !== String(id));
      return { assignments: next, dates: computeDates(next) };
    });
    scheduleRosterSync();
  },
  setOverride: (id, is_override) => {
    set((state) => ({
      assignments: state.assignments.map((a) =>
        String(a.id) === String(id) ? { ...a, is_override } : a,
      ),
    }));
    scheduleRosterSync();
  },

  // --- LIVE ROSTER GRID ---
  addRosterDate: (date, label) => {
    set((state) => {
      if (state.dates.includes(date)) return {};
      return {
        dates: [...state.dates, date].sort(),
        rosterMeta: {
          ...state.rosterMeta,
          [date]: { label: label || date, notes: "", detail: "" },
        },
      };
    });
    scheduleRosterSync();
  },
  removeRosterDate: (date) => {
    set((state) => {
      const rosterMeta = { ...state.rosterMeta };
      delete rosterMeta[date];
      return {
        dates: state.dates.filter((d) => d !== date),
        rosterMeta,
        assignments: state.assignments.filter((a) => a.date !== date),
      };
    });
    scheduleRosterSync();
  },
  assignSlot: (date, label, personName) => {
    const slot = ROSTER_SLOTS.find((s) => s.label === label);
    if (!slot) return;
    set((state) => {
      const id = `${date}::${label}`;
      const exists = state.assignments.some((a) => a.id === id);
      const assignments = exists
        ? state.assignments.map((a) =>
            a.id === id ? { ...a, person_name: personName } : a,
          )
        : [
            ...state.assignments,
            {
              id,
              date,
              area: slot.area,
              role: slot.role || slot.area,
              label,
              person_name: personName,
              is_override: false,
              notes: "",
              status: "pending" as const,
            },
          ];
      const dates = state.dates.includes(date)
        ? state.dates
        : [...state.dates, date].sort();
      const rosterMeta = state.rosterMeta[date]
        ? state.rosterMeta
        : { ...state.rosterMeta, [date]: { label: date, notes: "", detail: "" } };
      return { assignments, dates, rosterMeta };
    });
    scheduleRosterSync();
  },
  clearSlot: (date, label) => {
    set((state) => ({
      assignments: state.assignments.filter(
        (a) => !(a.date === date && a.label === label),
      ),
    }));
    scheduleRosterSync();
  },

  // --- BLOCKOUTS ---
  toggleBlockout: (personName, date, reason) => {
    set((state) => {
      const key = personName.trim().toLowerCase();
      const exists = state.blockouts.some(
        (b) => b.person_name.trim().toLowerCase() === key && b.date === date,
      );
      const blockouts = exists
        ? state.blockouts.filter(
            (b) => !(b.person_name.trim().toLowerCase() === key && b.date === date),
          )
        : [...state.blockouts, { person_name: personName.trim(), date, reason: reason ?? "" }];
      return { blockouts };
    });
    scheduleBlockoutSync();
  },
}));


// Helper used elsewhere in the app
export function findVolunteer(volunteers: Volunteer[], name: string): Volunteer | undefined {
  const lc = name.toLowerCase();
  return volunteers.find((v) => v.full_name.toLowerCase() === lc);
}
