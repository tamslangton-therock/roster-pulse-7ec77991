import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { readRoster } from "../sheets.server";

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export default defineTool({
  name: "get_person_schedule",
  title: "Get a person's serving schedule",
  description:
    "Show every past and upcoming roster slot for one volunteer, plus a simple fatigue summary (serves in the last and next 4 weeks, longest run of consecutive weeks).",
  inputSchema: {
    name: z.string().min(1).describe("Volunteer name (case-insensitive substring match)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ name }) => {
    const all = await readRoster();
    const needle = name.toLowerCase();
    const mine = all
      .filter((e) => e.person.toLowerCase().includes(needle))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (!mine.length) {
      return { content: [{ type: "text", text: `No roster entries found for "${name}".` }] };
    }

    const today = isoToday();
    const past = mine.filter((e) => e.date < today);
    const upcoming = mine.filter((e) => e.date >= today);

    const shift = (days: number) => {
      const d = new Date(`${today}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    };
    const last4 = past.filter((e) => e.date >= shift(-28)).length;
    const next4 = upcoming.filter((e) => e.date <= shift(28)).length;

    const dates = [...new Set(mine.map((e) => e.date))].sort();
    let longest = dates.length ? 1 : 0;
    let run = 1;
    for (let i = 1; i < dates.length; i++) {
      const gap =
        (Date.parse(`${dates[i]}T00:00:00Z`) - Date.parse(`${dates[i - 1]}T00:00:00Z`)) / 86400000;
      run = gap === 7 ? run + 1 : 1;
      longest = Math.max(longest, run);
    }

    const fmt = (list: typeof mine) =>
      list.map((e) => `${e.date} · ${e.slot}`).join("\n") || "(none)";

    const text = [
      `Total slots: ${mine.length} · last 4 weeks: ${last4} · next 4 weeks: ${next4} · longest consecutive-week run: ${longest}`,
      "",
      "Upcoming:",
      fmt(upcoming),
      "",
      "History (most recent last):",
      fmt(past.slice(-30)),
    ].join("\n");

    return {
      content: [{ type: "text", text }],
      structuredContent: {
        total: mine.length,
        servesLast4Weeks: last4,
        servesNext4Weeks: next4,
        longestConsecutiveWeeks: longest,
        upcoming,
        history: past,
      },
    };
  },
});
