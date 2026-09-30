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
