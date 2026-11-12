export const COMBINED_TEAM_AREA = "Hang Tight & Host";
export const COMBINED_TEAM_MEMBERS = ["Hang Tight", "Host"];

export function builderAreas(areas: string[]): string[] {
  if (!COMBINED_TEAM_MEMBERS.every((area) => areas.includes(area))) return areas;
  return areas.flatMap((area) =>
    area === "Hang Tight" ? [COMBINED_TEAM_AREA] : area === "Host" ? [] : [area],
  );
}

export function sourceAreas(area: string): string[] {
  return area === COMBINED_TEAM_AREA ? COMBINED_TEAM_MEMBERS : [area];
}

/** Existing area-prefixed team names pair by their shared team name, without rewriting rows. */
export function builderTeamName(area: string, name: string): string {
  if (!COMBINED_TEAM_MEMBERS.includes(area)) return name;
  const prefix = `${area} `;
  return name.startsWith(prefix) ? name.slice(prefix.length) : name;
}