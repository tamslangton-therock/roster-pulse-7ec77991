import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { readRoster } from "../sheets.server";

export default defineTool({
  name: "list_roster",
  title: "List roster assignments",
  description:
    "List who is rostered on which Sunday, optionally filtered by date range, serving area or person.",
  inputSchema: {
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Start date (YYYY-MM-DD), inclusive."),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("End date (YYYY-MM-DD), inclusive."),
    area: z.string().optional().describe("Serving area filter, e.g. 'Barista' or 'Kids'."),
    person: z.string().optional().describe("Person name filter (case-insensitive substring)."),
    limit: z.number().int().min(1).max(500).optional().describe("Max entries to return (default 200)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, area, person, limit }) => {
    const all = await readRoster();
    const filtered = all
      .filter((e) => (from ? e.date >= from : true))
      .filter((e) => (to ? e.date <= to : true))
      .filter((e) => (area ? e.area.toLowerCase().includes(area.toLowerCase()) : true))
      .filter((e) => (person ? e.person.toLowerCase().includes(person.toLowerCase()) : true))
      .sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot))
      .slice(0, limit ?? 200);

    const text = filtered.length
      ? filtered.map((e) => `${e.date} · ${e.slot} · ${e.person}`).join("\n")
      : "No roster entries match those filters.";
    return {
      content: [{ type: "text", text }],
      structuredContent: { count: filtered.length, entries: filtered },
    };
  },
});
