## Goal

On the Team Health page, clicking a volunteer row (e.g. Lelo) opens a side panel showing everywhere they've served historically and everywhere they're rostered upcoming — so you can see exactly why they're at burnout risk.

## What gets built

**Clickable rows** — every row in the Health overview table becomes clickable (with hover highlight), opening a right-side drawer for that person.

**Volunteer serving-history drawer** (new component `src/components/volunteer-history-drawer.tsx`):

- Header: name, current health badge, serving areas, paused state.
- Summary strip: total serves, serves in last 4 weeks, next 4 weeks, longest consecutive streak, and their monthly preference/target vs actual.
- Two sections, both grouped by month:
  - **Upcoming** — every future assignment: date (e.g. Sun 16 Aug), area — role, sub-team colour dot, and slot status (confirmed / pending / declined) if set.
  - **History** — every past assignment, same layout, most recent first, collapsed to the last 12 weeks with a "Show all history" toggle.
- Consecutive-week runs are visually marked: any date that is part of a 2+ week back-to-back run gets a small "week N of a run" tag, so the burnout cause is obvious at a glance.
- A small per-area breakdown ("Barista 9 · Count 4 · Kids 2") so over-commitment across areas is visible.
- Empty state when a volunteer has no assignments at all.

## Technical notes

- Data comes from the existing `assignments` in `useRoster()` — no new Google Sheets tabs, no schema change, no writes. Read-only view.
- Reuses `computeHealthRow` from `src/lib/health-settings.ts` for the status badge, and `resolveSubTeamColor` from `src/lib/person-colors.ts` for the colour dots, so it stays consistent with the roster and PDF.
- Built on the existing shadcn `Sheet` component; matching by `person_name` the same way the health calculations already do.
- Streak-run detection uses the same "exactly 7 days apart" rule already in the fatigue engine.
