import { create } from "zustand";
import { persist } from "zustand/middleware";
import seed from "@/data/seed.json";
import type { Volunteer, Team, Assignment } from "./types";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function normalizeName(n: string) {
  return n.trim().replace(/\s+/g, " ");
}

function buildInitial() {
  const volunteersByKey = new Map<string, Volunteer>();
  for (const v of (seed as any).volunteers) {
    const full_name = normalizeName(v.name);
    volunteersByKey.set(full_name.toLowerCase(), {
      id: uid(),
      full_name,
      email: "",
      phone: "",
      serving_areas: v.serving_areas || [],
      partners: v.partners || [],
      max_serving_per_month: 2,
      frequency_preference: "2x/month",
      priority_area: (v.serving_areas || [])[0] || "",
      is_paused: false,
      notes: v.notes || "",
      unavailable_dates: [],
    });
  }

  // Add any missing people referenced in assignments/teams so nothing breaks
  const ensurePerson = (name: string, area?: string) => {
    const clean = normalizeName(name).replace(/\s+&\s+.*$/i, "").trim();
    const key = clean.toLowerCase();
    if (!clean || volunteersByKey.has(key)) return;
    volunteersByKey.set(key, {
      id: uid(),
      full_name: clean,
      email: "",
      phone: "",
      serving_areas: area ? [area] : [],
      partners: [],
      max_serving_per_month: 2,
      frequency_preference: "2x/month",
      priority_area: area || "",
      is_paused: false,
      notes: "",
      unavailable_dates: [],
    });
  };

  const assignments: Assignment[] = [];
  for (const a of (seed as any).assignments) {
    // Handle "Wendy & Ian Klynsmith" as two people
    const parts = String(a.person).split(/\s+&\s+|\s+\+\s+/);
    for (const p of parts) {
      const person = normalizeName(p);
      if (!person) continue;
      ensurePerson(person, a.area);
      assignments.push({
        id: uid(),
        date: a.date,
        area: a.area,
        role: a.role,
        label: a.label,
        person_name: person,
        is_override: false,
      });
    }
  }

  const teams: Team[] = [];
  for (const t of (seed as any).teams) {
    for (const m of t.members) ensurePerson(m, t.area);
    teams.push({
      id: uid(),
      team_name: t.team_name,
      serving_area: t.area,
      member_names: t.members.map(normalizeName),
    });
  }

  const volunteers = Array.from(volunteersByKey.values()).sort((a, b) =>
    a.full_name.localeCompare(b.full_name),
  );

  const dates: string[] = (seed as any).dates.slice().sort();

  return { volunteers, teams, assignments, dates };
}

interface State {
  volunteers: Volunteer[];
  teams: Team[];
  assignments: Assignment[];
  dates: string[];
  ready: boolean;
  hydrate: () => void;
  updateVolunteer: (id: string, patch: Partial<Volunteer>) => void;
  togglePause: (id: string) => void;
  addVolunteer: (v: Omit<Volunteer, "id">) => void;
  addAssignment: (a: Omit<Assignment, "id">) => void;
  removeAssignment: (id: string) => void;
  swapAssignment: (id: string, newPerson: string) => void;
  setOverride: (id: string, override: boolean) => void;
  updateTeamMembers: (id: string, members: string[]) => void;
  addTeam: (team_name: string, area: string) => void;
  removeTeam: (id: string) => void;
  reseed: () => void;
}

export const useRoster = create<State>()(
  persist(
    (set, get) => ({
      volunteers: [],
      teams: [],
      assignments: [],
      dates: [],
      ready: false,
      hydrate: () => {
        if (get().ready) return;
        const initial = buildInitial();
        set({ ...initial, ready: true });
      },
      reseed: () => set({ ...buildInitial(), ready: true }),
      updateVolunteer: (id, patch) =>
        set({
          volunteers: get().volunteers.map((v) => (v.id === id ? { ...v, ...patch } : v)),
        }),
      togglePause: (id) =>
        set({
          volunteers: get().volunteers.map((v) =>
            v.id === id ? { ...v, is_paused: !v.is_paused } : v,
          ),
        }),
      addVolunteer: (v) =>
        set({
          volunteers: [...get().volunteers, { ...v, id: uid() }].sort((a, b) =>
            a.full_name.localeCompare(b.full_name),
          ),
        }),
      addAssignment: (a) => set({ assignments: [...get().assignments, { ...a, id: uid() }] }),
      removeAssignment: (id) =>
        set({ assignments: get().assignments.filter((a) => a.id !== id) }),
      swapAssignment: (id, newPerson) =>
        set({
          assignments: get().assignments.map((a) =>
            a.id === id ? { ...a, person_name: newPerson } : a,
          ),
        }),
      setOverride: (id, override) =>
        set({
          assignments: get().assignments.map((a) =>
            a.id === id ? { ...a, is_override: override } : a,
          ),
        }),
      updateTeamMembers: (id, members) =>
        set({
          teams: get().teams.map((t) => (t.id === id ? { ...t, member_names: members } : t)),
        }),
      addTeam: (team_name, area) =>
        set({ teams: [...get().teams, { id: uid(), team_name, serving_area: area, member_names: [] }] }),
      removeTeam: (id) => set({ teams: get().teams.filter((t) => t.id !== id) }),
    }),
    {
      name: "roster-pulse-v1",
      partialize: (s) => ({
        volunteers: s.volunteers,
        teams: s.teams,
        assignments: s.assignments,
        dates: s.dates,
        ready: s.ready,
      }),
    },
  ),
);

// Selectors / helpers
export function findVolunteer(volunteers: Volunteer[], name: string) {
  const n = name.trim().toLowerCase();
  return volunteers.find((v) => v.full_name.toLowerCase() === n);
}
