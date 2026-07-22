import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Team, Volunteer, Assignment } from "./types";
import { initialTeams, initialVolunteers, initialAssignments } from "../data/mockData";

interface RosterState {
  teams: Team[];
  volunteers: Volunteer[];
  assignments: Assignment[];

  // Team Actions
  addTeam: (team_name: string, serving_area: string) => void;
  removeTeam: (id: string) => void;
  updateTeam: (id: string, updates: Partial<Team>) => void;
  updateTeamMembers: (teamId: string, memberNames: string[]) => void;

  // Volunteer Actions
  addVolunteer: (volunteer: Omit<Volunteer, "id">) => void;
  removeVolunteer: (id: string) => void;
  updateVolunteer: (id: string, updates: Partial<Volunteer>) => void;

  // Assignment Actions
  setAssignments: (assignments: Assignment[]) => void;
  updateAssignment: (id: string, updates: Partial<Assignment>) => void;
}

export const useRoster = create<RosterState>()(
  persist(
    (set) => ({
      teams: initialTeams,
      volunteers: initialVolunteers,
      assignments: initialAssignments,

      // --- TEAMS ---
      addTeam: (team_name, serving_area) =>
        set((state) => ({
          teams: [
            ...state.teams,
            {
              id: `team-${Date.now()}`,
              team_name,
              serving_area,
              member_names: [],
            },
          ],
        })),

      removeTeam: (id) =>
        set((state) => ({
          teams: state.teams.filter((t) => t.id !== id),
        })),

      updateTeam: (id, updates) =>
        set((state) => ({
          teams: state.teams.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),

      updateTeamMembers: (teamId, memberNames) =>
        set((state) => ({
          teams: state.teams.map((t) =>
            t.id === teamId ? { ...t, member_names: memberNames } : t
          ),
        })),

      // --- VOLUNTEERS ---
      addVolunteer: (volunteer) =>
        set((state) => ({
          volunteers: [
            ...state.volunteers,
            {
              ...volunteer,
              id: `vol-${Date.now()}`,
            },
          ],
        })),

      removeVolunteer: (id) =>
        set((state) => ({
          volunteers: state.volunteers.filter((v) => v.id !== id),
        })),

      updateVolunteer: (id, updates) =>
        set((state) => ({
          volunteers: state.volunteers.map((v) =>
            v.id === id ? { ...v, ...updates } : v
          ),
        })),

      // --- ASSIGNMENTS ---
      setAssignments: (assignments) => set({ assignments }),

      updateAssignment: (id, updates) =>
        set((state) => ({
          assignments: state.assignments.map((a) =>
            a.id === id ? { ...a, ...updates } : a
          ),
        })),
    }),
    {
      name: "roster-pulse-v3",
    }
  )
);
