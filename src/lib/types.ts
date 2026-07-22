export type FatigueStatus =
  | "healthy"
  | "could_do_more"
  | "no_rest"
  | "burnout"
  | "paused"
  | "inactive";

export interface Volunteer {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  serving_areas: string[];
  partners: string[]; // names
  max_serving_per_month: number;
  frequency_preference: string; // "1x/month" | "2x/month" | "fortnight" | "weekly"
  priority_area: string;
  is_paused: boolean;
  notes: string;
  blackout_dates?: string[];
}

export interface Team {
  id: string;
  team_name: string;
  serving_area: string;
  member_names: string[];
}

export interface Assignment {
  id: string;
  date: string; // "YYYY-MM-DD"
  area: string;
  label: string;
  person_name: string;
}
