import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * AI Auto-Roster — asks a model via the Lovable AI Gateway to draft balanced
 * volunteer suggestions for upcoming Sundays. The client sends a compact
 * snapshot of volunteers, slots, blockouts, allowed clashes, existing
 * assignments and recent serving history; the server fn builds the prompt,
 * calls the gateway and returns structured suggestions.
 */

const volunteerSchema = z.object({
  name: z.string(),
  areas: z.array(z.string()),
  freq: z.string(),
  max: z.number(),
  partners: z.array(z.string()),
  priority: z.string(),
});

const inputSchema = z.object({
  dates: z.array(z.string()).min(1),
  mode: z.enum(["fill_empty", "draft_full"]),
  volunteers: z.array(volunteerSchema),
  slots: z.array(
    z.object({ label: z.string(), area: z.string(), role: z.string() }),
  ),
  /** Per-area target headcount for a normal Sunday (extra slots are optional). */
  targets: z.array(z.object({ area: z.string(), target: z.number() })),
  /** Ideal team compositions configured in Team Builder. */
  subTeams: z.array(
    z.object({
      area: z.string(),
      name: z.string(),
      members: z.array(z.object({ slot_label: z.string(), person_name: z.string() })),
    }),
  ),
  /** Verified candidate pool per slot label — the model may only pick from these. */
  candidates: z.array(
    z.object({ slot_label: z.string(), people: z.array(z.string()) }),
  ),
  /** Which exact slots each person has actually served recently. */
  provenRoles: z.array(
    z.object({ name: z.string(), slots: z.array(z.string()) }),
  ),
  /** Groups that regularly served together in the same area on the same Sunday. */
  affinity: z.array(
    z.object({ area: z.string(), people: z.array(z.string()), times: z.number() }),
  ),
  blockouts: z.array(
    z.object({ person_name: z.string(), date: z.string(), reason: z.string() }),
  ),
  allowedClashes: z.array(
    z.object({ area_a: z.string(), area_b: z.string() }),
  ),
  existing: z.array(
    z.object({ date: z.string(), label: z.string(), person_name: z.string() }),
  ),
  recent: z.array(
    z.object({
      name: z.string(),
      count8w: z.number(),
      lastServed: z.string(),
    }),
  ),
  priorities: z.string().optional(),
});


export type AiRosterInput = z.infer<typeof inputSchema>;

export interface AiRosterSuggestion {
  date: string;
  slot_label: string;
  person_name: string;
  reason_tags: string[];
  note: string;
}

export interface AiRosterUnfilled {
  date: string;
  slot_label: string;
  reason: string;
}

export interface AiRosterResult {
  suggestions: AiRosterSuggestion[];
  unfilled: AiRosterUnfilled[];
  summary: string;
}

/** Run-ID propagation helper (gateway mints the id; never mint in app code). */
const RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";
function createRunIdFetch() {
  let runId: string | undefined;
  return {
    getRunId: () => runId,
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(RUN_ID_HEADER)) headers.set(RUN_ID_HEADER, runId);
      const response = await fetch(input, { ...init, headers });
      runId ??= response.headers.get(RUN_ID_HEADER)?.trim() || undefined;
      return response;
    },
  };
}

/** Strict structured-output schema (object root, all props required). */
const outputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["suggestions", "unfilled", "summary"],
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "slot_label", "person_name", "reason_tags", "note"],
        properties: {
          date: { type: "string" },
          slot_label: { type: "string" },
          person_name: { type: "string" },
          reason_tags: { type: "array", items: { type: "string" } },
          note: { type: "string" },
        },
      },
    },
    unfilled: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "slot_label", "reason"],
        properties: {
          date: { type: "string" },
          slot_label: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
    summary: { type: "string" },
  },
} as const;

const SYSTEM_PROMPT = `You are an expert church roster scheduler. You draft Sunday serving rosters for a church from the volunteer data provided.

HARD RULES (never break):
1. Never roster someone on a date they are blocked out for.
2. Only roster a person into a slot if that person appears in the candidate list for that exact slot_label. If the candidate list for a slot is empty, leave the slot unfilled.
3. Never give a person two slots on the same date unless that pair of areas is in allowedClashes. Re-read allowedClashes before any double assignment.
4. Never roster a person more than max times in one month across existing + suggested assignments.
5. Respect frequency preference: "weekly" = every week; "fortnightly" or "2x/month" = about every 2 weeks; "1x/month" = once in the month.
6. Avoid 3 consecutive serving weeks; prefer at least one rest week between serves.
7. PARTNERS: people listed as partners must serve on the SAME date. When you assign a person whose partner is active, also assign the partner to a suitable open slot on that same date if one exists; otherwise prefer a different date where both can serve together.
8. Never invent names or slot labels — use exactly the names and slot labels provided.
9. Paused or directory-only volunteers are already excluded; do not invent others.
10. STAFFING TARGETS: each area has a "target" headcount for a normal Sunday. Fill up to that many slots per area per date; leave surplus slots (beyond the target) empty rather than forcing people into them. Extra slots exist only as backup. Use "priorities" notes from the user if given to override targets.

TEAM KNOWLEDGE (use this, do not roster randomly):
- SUB-TEAMS: ideal team compositions the church already built (area, team name, members with their slots). Prefer rostering an intact sub-team for an area on a given Sunday over mixing strangers. When a sub-team member is blocked out, over their monthly limit, or due a rest week, substitute from the same slot's candidate list and say so.
- PROVEN ROLES: the exact slots each person has actually served recently. People are strongest in their proven roles — prefer them.
- AFFINITY GROUPS: groups of people who regularly served together in the same area. Replicate these working combinations when rotating weeks.

SOFT PRIORITIES (in order): keep sub-teams intact, partner alignment, proven role match, frequency match, rest/fatigue fairness, spread serving across everyone rather than reusing the same people, priority area.

Tag each suggestion with reason_tags from: "sub_team", "partner_aligned", "frequency_match", "rested", "priority_area", "fair_rotation", "allowed_clash_ok", "proven_role".
In "note" give one short human-readable sentence (max 12 words) explaining the choice.
List every slot within the staffing target that you could not fill in "unfilled" with the reason — do NOT list slots left empty because they were beyond the target. In "summary" give a 1-2 sentence overview.`;

export const suggestRoster = createServerFn({ method: "POST" })
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<AiRosterResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this app");

    const runIdFetch = createRunIdFetch();
    const userPayload = {
      dates: data.dates,
      mode: data.mode,
      slots: data.slots,
      volunteers: data.volunteers,
      staffingTargets: data.targets,
      subTeams: data.subTeams,
      candidatePools: data.candidates,
      provenRoles: data.provenRoles,
      affinityGroups: data.affinity,
      blockouts: data.blockouts,
      allowedClashes: data.allowedClashes,
      existingAssignments: data.existing,
      recentHistory: data.recent,
      notes:
        data.mode === "fill_empty"
          ? "Keep existingAssignments; only fill slots with no person, up to each area's staffing target."
          : "Draft a full roster; you may reassign any slot. Treat existingAssignments as the recent pattern to learn from — replicate sub-teams and affinity groups that worked.",
      ...(data.priorities ? { priorities: data.priorities } : {}),
    };

    const response = await runIdFetch.fetch(
      "https://ai.gateway.lovable.dev/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: "openai/gpt-6-astra",
          stream: true,
          store: false,
          reasoning: { effort: "medium", summary: "auto" },
          include: ["reasoning.encrypted_content"],
          instructions: SYSTEM_PROMPT,
          input: [
            {
              role: "user",
              content: `Draft the roster for these Sundays:\n${JSON.stringify(userPayload)}`,
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "roster_suggestions",
              strict: true,
              schema: outputSchema,
            },
          },
        }),
      },
    );

    if (!response.ok) {
      const bodyText = await response.text();
      let safeMessage = `AI request failed (${response.status})`;
      try {
        const parsed = JSON.parse(bodyText) as { message?: string; error?: { message?: string } };
        safeMessage = parsed.message ?? parsed.error?.message ?? safeMessage;
      } catch {
        // keep default message
      }
      throw new Error(safeMessage);
    }

    // Consume the SSE stream server-side and accumulate the final text.
    const body = response.body;
    if (!body) throw new Error("AI returned an empty response");
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let streamError: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const event = JSON.parse(payload) as {
            type?: string;
            delta?: string;
            message?: string;
          };
          if (event.type === "response.output_text.delta" && event.delta) {
            text += event.delta;
          } else if (event.type === "response.error" || event.type === "error") {
            streamError = event.message ?? "AI response failed";
          } else if (event.type === "response.failed") {
            streamError = "AI response failed";
          }
        } catch {
          // ignore malformed keep-alive lines
        }
      }
    }

    if (streamError) throw new Error(streamError);

    let parsed: AiRosterResult;
    try {
      parsed = JSON.parse(text) as AiRosterResult;
    } catch {
      throw new Error("AI returned an unreadable roster. Please try again.");
    }

    // Normalise: drop suggestions referencing unknown names/slots is done
    // client-side (it owns the store); keep the shape stable here.
    return {
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      unfilled: Array.isArray(parsed.unfilled) ? parsed.unfilled : [],
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
    };
  });
