<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Roster layout is dynamic
Serving-area columns on Live_Roster are data, not constants: `src/lib/roster-grid.ts` builds slots from the sheet's header rows (Row 1 = area, Row 2 = role) and clash formulas use the live slot count. Any new page that needs columns must read `slots` from `src/lib/store.ts` (`useRoster()`), never `ROSTER_SLOTS`.

- AI auto-roster: `src/lib/ai-roster.functions.ts` calls the Lovable AI Gateway `/v1/responses` (`openai/gpt-6-astra`, streamed SSE, strict json_schema) — client sends the volunteer/slot snapshot; the server fn owns the key and prompt. Review-then-apply lives in `src/components/ai-roster-dialog.tsx`.

- Team Health labels and thresholds are master settings persisted in the `Health_Config` sheet tab so every login uses the same definitions.

- Discipleship pipeline (`/discipleship`) reads/writes the `Discipleship` sheet tab via its own fetch/write functions in sheets.functions.ts (not the main store); access is the `discipleship_access` column (none/view/edit) on `User_Access`, checked by `canViewDiscipleship`/`canEditDiscipleship`. Blank column = no access (new permission), so grant leaders explicitly.
- Google Sheets reads go through the cached `gwFetch` in sheets.functions.ts (in-flight dedupe, 20s data TTL, long-lived row-1 probes, cleared on writes) — the ~60 reads/min quota otherwise turns reloads into 60s 429 stalls.
- Shared birthday WhatsApp templates are persisted as JSON in the existing `Health_Config` key/value tab so every login uses the same messages without adding another Sheets read.
