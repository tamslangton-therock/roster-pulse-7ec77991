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
          teams: state.teams.filter((t) => String(t.id) !== String(id)),
        })),

      updateTeam: (id, updates) =>
        set((state) => ({
          teams: state.teams.map((t) =>
            String(t.id) === String(id) ? { ...t, ...updates } : t
          ),
        })),

      updateTeamMembers: (teamId, memberNames) =>
        set((state) => ({
          teams: state.teams.map((t) =>
            String(t.id) === String(teamId) ? { ...t, member_names: memberNames } : t
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
          volunteers: state.volunteers.filter((v) => String(v.id) !== String(id)),
        })),

      updateVolunteer: (id, updates) =>
        set((state) => {
          const targetVolunteer = state.volunteers.find(
            (v) => String(v.id) === String(id)
          );
          const oldName = targetVolunteer?.full_name;
          const newName = updates.full_name;

          // 1. Update the volunteer list
          const updatedVolunteers = state.volunteers.map((v) =>
            String(v.id) === String(id) ? { ...v, ...updates } : v
          );

          // If full_name wasn't changed, return early
          if (!oldName || !newName || oldName === newName) {
            return { volunteers: updatedVolunteers };
          }

          // 2. Cascade updated volunteer name into Teams member_names array
          const updatedTeams = state.teams.map((team) => ({
            ...team,
            member_names: team.member_names.map((name) =>
              name === oldName ? newName : name
            ),
          }));

          // 3. Cascade updated volunteer name into Assignments
          const updatedAssignments = state.assignments.map((assignment) => {
            if ((assignment as any).volunteer_name === oldName) {
              return { ...assignment, volunteer_name: newName };
            }
            return assignment;
          });

          return {
            volunteers: updatedVolunteers,
            teams: updatedTeams,
            assignments: updatedAssignments,
          };
        }),

      // --- ASSIGNMENTS ---
      setAssignments: (assignments) => set({ assignments }),

      updateAssignment: (id, updates) =>
        set((state) => ({
          assignments: state.assignments.map((a) =>
            String(a.id) === String(id) ? { ...a, ...updates } : a
          ),
        })),
    }),
    {
      name: "roster-pulse-v4", // Incremented storage version to automatically refresh cache
    }
  )
);
