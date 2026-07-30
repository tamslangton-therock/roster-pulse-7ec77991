/** Deterministic pastel colour per serving team, so a team always looks the same. */

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export interface PersonColor {
  bg: string;
  border: string;
  text: string;
}

/** Well-spaced hues that all read as soft pastels. */
const HUES = [
  8, 24, 40, 56, 72, 92, 112, 132, 152, 172, 190, 208, 224, 244, 262, 280, 298, 318, 336, 352,
];

/** One consistent pastel per team / serving area. */
export function teamColor(team: string): PersonColor {
  const key = team.trim().toLowerCase();
  const h = hash(key);
  const hue = HUES[h % HUES.length];
  const sat = 55 + ((h >> 5) % 3) * 8; // 55 / 63 / 71
  const light = 89 + ((h >> 9) % 2) * 3; // 89 / 92
  return {
    bg: `hsl(${hue} ${sat}% ${light}%)`,
    border: `hsl(${hue} ${sat}% ${light - 14}%)`,
    text: `hsl(${hue} ${Math.min(sat + 10, 80)}% 26%)`,
  };
}

/** One consistent pastel per sub-team (unique within its serving area). */
export function subTeamColor(area: string, subTeam: string): PersonColor {
  const key = `${area.trim().toLowerCase()}::${subTeam.trim().toLowerCase()}`;
  const h = hash(key);
  const hue = HUES[h % HUES.length];
  const sat = 58 + ((h >> 5) % 3) * 8;
  const light = 88 + ((h >> 9) % 2) * 3;
  return {
    bg: `hsl(${hue} ${sat}% ${light}%)`,
    border: `hsl(${hue} ${sat}% ${light - 16}%)`,
    text: `hsl(${hue} ${Math.min(sat + 10, 80)}% 25%)`,
  };
}

/** Hand-picked pastel swatches users can assign to a sub-team. */
export interface Swatch extends PersonColor {
  id: string;
  label: string;
}

function pastel(id: string, label: string, hue: number, sat = 62): Swatch {
  return {
    id,
    label,
    bg: `hsl(${hue} ${sat}% 90%)`,
    border: `hsl(${hue} ${sat}% 74%)`,
    text: `hsl(${hue} ${Math.min(sat + 10, 80)}% 26%)`,
  };
}

export const PASTEL_SWATCHES: Swatch[] = [
  pastel("blush", "Blush", 352),
  pastel("coral", "Coral", 12),
  pastel("apricot", "Apricot", 28),
  pastel("butter", "Butter", 46),
  pastel("lemon", "Lemon", 58),
  pastel("lime", "Lime", 82),
  pastel("sage", "Sage", 108, 40),
  pastel("mint", "Mint", 152),
  pastel("seafoam", "Seafoam", 172),
  pastel("sky", "Sky", 196),
  pastel("cornflower", "Cornflower", 216),
  pastel("periwinkle", "Periwinkle", 238),
  pastel("lavender", "Lavender", 262),
  pastel("orchid", "Orchid", 288),
  pastel("rose", "Rose", 322),
  pastel("stone", "Stone", 24, 14),
];

/** Colour for a sub-team: a chosen swatch when set, otherwise the auto pastel. */
export function resolveSubTeamColor(
  area: string,
  subTeam: string,
  colorId?: string,
): PersonColor {
  if (colorId) {
    const found = PASTEL_SWATCHES.find((s) => s.id === colorId);
    if (found) return { bg: found.bg, border: found.border, text: found.text };
  }
  return subTeamColor(area, subTeam);
}
