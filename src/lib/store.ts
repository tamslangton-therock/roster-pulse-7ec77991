import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Volunteer, Assignment } from "./types";

interface RosterStore {
  volunteers: Volunteer[];
  assignments: Assignment[];
  blackoutsMap: Record<string, string[]>;
  
  // Actions
  setVolunteers: (volunteers: Volunteer[]) => void;
  updateVolunteer: (volunteer: Volunteer) => void;
  setAssignments: (assignments: Assignment[]) => void;
  toggleBlackoutDate: (volunteerName: string, dateStr: string) => void;
  getBlackoutDates: (volunteerName: string) => string[];
  resetStore: () => void;
}

const initialVolunteers: Volunteer[] = [
  {
    id: "1",
    full_name: "Alex Morgan",
    email: "alex.m@example.com",
    phone: "555-0101",
    serving_areas: ["Worship", "AV"],
    is_paused: false,
    blackout_dates: [],
  },
  {
    id: "2",
    full_name: "Sam Taylor",
    email: "sam.t@example.com",
    phone: "555-0102",
    serving_areas: ["Welcome", "Hospitality"],
    is_paused: false,
    blackout_dates: [],
  },
];

const initialAssignments: Assignment[] = [];

export const useRoster = create<RosterStore>()(
  persist(
    (set, get) => ({
      volunteers: initialVolunteers,
      assignments: initialAssignments,
      blackoutsMap: {},

      setVolunteers: (volunteers) =>
        set({ volunteers: Array.isArray(volunteers) ? volunteers : [] }),

      updateVolunteer: (updated) =>
        set((state) => {
          const current = Array.isArray(state.volunteers) ? state.volunteers : [];
          return {
            volunteers: current.map((v) => (v.id === updated.id ? updated : v)),
          };
        }),

      setAssignments: (assignments) =>
        set({ assignments: Array.isArray(assignments) ? assignments : [] }),

      toggleBlackoutDate: (volunteerName, dateStr) => {
        if (!volunteerName || !dateStr) return;
        const key = volunteerName.toLowerCase();

        set((state) => {
          const currentMap = state.blackoutsMap || {};
          const currentDates = Array.isArray(currentMap[key]) ? currentMap[key] : [];
          const updatedDates = currentDates.includes(dateStr)
            ? currentDates.filter((d) => d !== dateStr)
            : [...currentDates, dateStr].sort();

          // Also keep individual volunteer object in sync if present
          const currentVolunteers = Array.isArray(state.volunteers) ? state.volunteers : [];
          const updatedVolunteers = currentVolunteers.map((v) => {
            if (v?.full_name?.toLowerCase() === key) {
              return {
                ...v,
                blackout_dates: updatedDates,
              };
            }
            return v;
          });

          return {
            blackoutsMap: {
              ...currentMap,
              [key]: updatedDates,
            },
            volunteers: updatedVolunteers,
          };
        });
      },

      getBlackoutDates: (volunteerName) => {
        if (!volunteerName) return [];
        const key = volunteerName.toLowerCase();
        const state = get();
        
        const mapDates = state?.blackoutsMap?.[key];
        if (Array.isArray(mapDates)) return mapDates;

        const vol = (state?.volunteers || []).find(
          (v) => v?.full_name?.toLowerCase() === key
        );
        return Array.isArray(vol?.blackout_dates) ? vol.blackout_dates : [];
      },

      resetStore: () =>
        set({
          volunteers: initialVolunteers,
          assignments: initialAssignments,
          blackoutsMap: {},
        }),
    }),
    {
      name: "roster-pulse-storage",
      storage: createJSONStorage(() => localStorage),
      // Merge strategy guarantees empty arrays if localStorage contained bad/corrupted data
      merge: (persistedState: any, currentState) => {
        const merged = { ...currentState, ...(persistedState as object) };
        return {
          ...merged,
          volunteers: Array.isArray(merged.volunteers) ? merged.volunteers : currentState.volunteers,
          assignments: Array.isArray(merged.assignments) ? merged.assignments : currentState.assignments,
          blackoutsMap: merged.blackoutsMap && typeof merged.blackoutsMap === "object" ? merged.blackoutsMap : {},
        };
      },
    }
  )
);
