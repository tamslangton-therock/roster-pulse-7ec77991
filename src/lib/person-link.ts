import type { Volunteer } from "./types";

/** One person = one name. Normalises case and spacing so "tamara  jade" matches "Tamara Jade". */
export const personKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

export function findIndividual(volunteers: Volunteer[], name: string): Volunteer | undefined {
  const k = personKey(name);
  if (!k) return undefined;
  return volunteers.find((v) => personKey(v.full_name) === k);
}
