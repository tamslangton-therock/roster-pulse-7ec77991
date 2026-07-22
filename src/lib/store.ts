import { create } from "zustand";
import { initialVolunteers, initialAssignments, initialDates } from "@/data/roster-data";
import type { Volunteer, Assignment } from "@/lib/types";

interface RosterState {
  volunteers: Volunteer[];
  assignments: Assignment[];
  dates: string[];
  blackoutsMap: Record<string, string[]>; // volunteerId or lowercase name -> dates[]
  
  // Actions
  addVolunteer: (volunteer: Volunteer) => void;
  updateVolunteer: (volunteer: Volunteer) => void;
  setVolunteerBlackouts: (volunteerName: string, dates: string[]) => void;
  toggleBlackoutDate: (volunteerName: string, dateStr: string) => void;
}

export const useRoster = create<RosterState>((set) => ({
  volunteers: initialVolunteers,
  assignments: initialAssignments,
  dates: initialDates,
  blackoutsMap: {
    "tamara langton": ["2026-08-02", "2026-08-16"],
  },

  addVolunteer: (volunteer) =>
    set((state) => ({ volunteers: [...state.volunteers, volunteer] })),

  updateVolunteer: (volunteer) =>
    set((state) => ({
      volunteers: state.volunteers.map((v) =>
        v.id === volunteer.id ? volunteer : v
      ),
    })),

  setVolunteerBlackouts: (volunteerName, dates) =>
    set((state) => ({
      blackoutsMap: {
        ...state.blackoutsMap,
        [volunteerName.toLowerCase()]: dates,
      },
    })),

  toggleBlackoutDate: (volunteerName, dateStr) =>
    set((state) => {
      const key = volunteerName.toLowerCase();
      const current = state.blackoutsMap[key] || [];
      const updated = current.includes(dateStr)
        ? current.filter((d) => d !== dateStr)
        : [...current, dateStr].sort();

      return {
        blackoutsMap: {
          ...state.blackoutsMap,
          [key]: updated,
        },
      };
    }),
}));

export function findVolunteer(volunteers: Volunteer[], name: string) {
  return volunteers.find(
    (v) => v.full_name.toLowerCase() === name.toLowerCase()
  );
}
