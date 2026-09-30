// Login server function — checks a team leader's username + password against
// the User_Access tab in Google Sheets and returns their permissions (never
// the password itself).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { readUserAccessRows } from "./users.server";
import { toSessionUser, type SessionUser } from "./user-access";

export const loginTeamUser = createServerFn({ method: "POST" })
  .inputValidator((data: { username: string; password: string }) =>
    z.object({ username: z.string(), password: z.string() }).parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> => {
    const username = data.username.trim();
    if (!username || !data.password) {
      return { ok: false, error: "Enter your name and password." };
    }
    let rows;
    try {
      rows = await readUserAccessRows();
    } catch (err) {
      return {
        ok: false,
        error: `Could not reach the users list: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    const match = rows.find(
      (r) => r.username.toLowerCase() === username.toLowerCase(),
    );
    if (!match || match.password !== data.password) {
      return { ok: false, error: "Name or password is incorrect." };
    }
    return { ok: true, user: toSessionUser({ ...match }) };
  });
