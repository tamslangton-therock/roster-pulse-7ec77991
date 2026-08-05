import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { readRoster } from "../sheets.server";

export default defineTool({
  name: "get_sunday",
  title: "Get one Sunday's roster",
  description: "Show everyone rostered on a single date, grouped by serving area.",
  inputSchema: {
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("The date to look up (YYYY-MM-DD)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ date }) => {
    const entries = (await readRoster()).filter((e) => e.date === date);
    if (!entries.length) {
      return { content: [{ type: "text", text: `Nobody is rostered on ${date}.` }] };
    }

    const byArea = new Map<string, string[]>();
    for (const e of entries) {
      const line = `${e.role ? `${e.role}: ` : ""}${e.person}`;
      byArea.set(e.area, [...(byArea.get(e.area) ?? []), line]);
    }

    const counts = new Map<string, number>();
    for (const e of entries) counts.set(e.person, (counts.get(e.person) ?? 0) + 1);
    const doubleBooked = [...counts.entries()].filter(([, n]) => n > 1).map(([p]) => p);

    const text = [
      `Roster for ${date} (${entries.length} slots filled):`,
      ...[...byArea.entries()].map(([area, lines]) => `\n${area}\n  ${lines.join("\n  ")}`),
      doubleBooked.length
        ? `\nServing in more than one area: ${doubleBooked.join(", ")}`
        : "\nNobody is serving in more than one area.",
    ].join("\n");

    return {
      content: [{ type: "text", text }],
      structuredContent: { date, entries, doubleBooked },
    };
  },
});
