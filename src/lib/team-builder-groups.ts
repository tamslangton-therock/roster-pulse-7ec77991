/**
 * Crews that serve together and are built as one team in Team Builder.
 * Each crew is presented as a single "A & B" area; edits and Sunday
 * application keep every slot's original serving area and stored team names
 * so the Google Sheet stays compatible.
 */
export const COMBINED_TEAM_CREWS: string[][] = [
  ["Hang Tight", "Host"],
  ["Camera", "Media"],
];

export const COMBINED_TEAM_AREA = "Hang Tight & Host";
export const COMBINED_TEAM_MEMBERS = ["Hang Tight", "Host"];

function crewFor(area: string): string[] | undefined {
  return COMBINED_TEAM_CREWS.find((crew) => crew.includes(area));
}

export function combinedAreaName(crew: string[]): string {
  return crew.join(" & ");
}

export function builderAreas(areas: string[]): string[] {
  return areas.flatMap((area) => {
    const crew = crewFor(area);
    if (!crew || !crew.every((member) => areas.includes(member))) return [area];
    return crew[0] === area ? [combinedAreaName(crew)] : [];
  });
}

export function sourceAreas(area: string): string[] {
  const crew = COMBINED_TEAM_CREWS.find((c) => combinedAreaName(c) === area);
  return crew ?? [area];
}

/** Existing area-prefixed team names pair by their shared team name, without rewriting rows. */
export function builderTeamName(area: string, name: string): string {
  if (!crewFor(area)) return name;
  const prefix = `${area} `;
  return name.startsWith(prefix) ? name.slice(prefix.length) : name;
}
