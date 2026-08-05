import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { readVolunteers } from "../sheets.server";

export default defineTool({
  name: "list_volunteers",
  title: "List volunteers",
  description:
    "List volunteers with their serving areas, monthly limit, frequency preference, partner links and paused state. Contact details are not exposed.",
  inputSchema: {
    search: z.string().optional().describe("Filter by name or serving area (case-insensitive)."),
    paused_only: z.boolean().optional().describe("Only return volunteers who are currently paused."),
    limit: z.number().int().min(1).max(500).optional().describe("Max volunteers to return (default 200)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, paused_only, limit }) => {
    const all = await readVolunteers();
    const needle = search?.toLowerCase();
    const filtered = all
      .filter((v) =>
        needle
          ? v.full_name.toLowerCase().includes(needle) ||
            v.serving_areas.some((a) => a.toLowerCase().includes(needle))
          : true,
      )
      .filter((v) => (paused_only ? v.is_paused : true))
      .slice(0, limit ?? 200);

    const text = filtered.length
      ? filtered
          .map(
            (v) =>
              `${v.full_name}${v.is_paused ? " (paused)" : ""} — areas: ${
                v.serving_areas.join(", ") || "none"
              }; max/month: ${v.max_serving_per_month || "n/a"}; preference: ${
                v.frequency_preference || "n/a"
              }${v.partners.length ? `; partners: ${v.partners.join(", ")}` : ""}`,
          )
          .join("\n")
      : "No volunteers match that filter.";

    return {
      content: [{ type: "text", text }],
      structuredContent: { count: filtered.length, volunteers: filtered },
    };
  },
});
