# Roll back yesterday's agent-integration work, then fix syncing

## What happened yesterday

Yesterday's change added the agent integration (MCP) layer on top of the roster app:

- Cloud backend + Google sign-in turned on, purely to authenticate MCP callers
- An MCP server at `/mcp` with four read-only tools, plus its OAuth consent page
- A global sign-in middleware that now wraps **every** server call the app makes — including the Google Sheets reads and writes
- A change to the passcode gate so the consent page can bypass it

Nothing in the roster, volunteer, print, team-builder or sync logic was rewritten yesterday, so removing the MCP layer does not put your roster features at risk.

## Step 1 — Undo it

Remove the agent-integration layer and return the app to what it was before:

- Delete the MCP server definition, the four tools, the server-only Sheets reader used by them, and the generated MCP routes
- Delete the OAuth consent page and restore the passcode gate to its previous form
- Remove the MCP build plugin and the MCP packages
- Remove the global auth middleware so app server calls run plain again

Alternative if you'd rather not have me hand-remove it: use the History tab and restore the version from just before the agent-integration message. That is an exact rollback. Tell me if you prefer that and I'll stop here.

## Step 2 — Why saving isn't reaching the sheet

Confirmed already: the connection to **Roster Pulse — Live Database** is healthy and all eight tabs (Volunteers, Teams, Assignments, Live_Roster, Blockouts, Statuses, Allowed_Clashes, Sub_Teams) are reachable right now. So the sheet and the credentials are fine — the break is in the app.

The most likely cause is the global sign-in middleware added yesterday. It now runs before every save call and asks the browser for a signed-in user. You use the app through the passcode gate, not a Google login, so those calls can fail or stall before they ever reach the sheet — which matches "it worked, then it stopped after yesterday". This is a strong suspicion, not yet proven, so:

1. Reproduce a save in the running app and capture the exact failure from the browser and server logs
2. Confirm the cause from that evidence (rather than assuming)
3. Removing the middleware in Step 1 likely fixes it; if the logs point elsewhere, fix what they actually show
4. Verify by making a real edit in the app and reading the changed row straight back out of the sheet

## Step 3 — Make failures visible

Sync already shows a toast on failure, but a failed save currently leaves the change looking saved on screen. Add a persistent "Not saved — retry" state on the save control so a silent failure can't be mistaken for a successful save again.

## Technical notes

- Files removed: `src/lib/mcp/**`, `src/routes/mcp.ts`, `src/routes/[.mcp]/**`, `src/routes/[.well-known]/oauth-protected-resource.ts`, `src/routes/[.]lovable.oauth.consent.tsx`, `.lovable/mcp/manifest.json`; `mcpPlugin()` dropped from `vite.config.ts`; `attachSupabaseAuth` dropped from `functionMiddleware` in `src/start.ts`
- Untouched: `src/lib/sheets.functions.ts`, `src/lib/store.ts`, `src/lib/roster-engine.ts`, all routes and components for roster/volunteers/health/teams/print
- The cloud backend itself stays provisioned but unused; nothing in the app will call it
