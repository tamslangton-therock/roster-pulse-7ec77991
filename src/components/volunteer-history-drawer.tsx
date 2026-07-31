import { useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { useRoster } from "@/lib/store";
import { resolveSubTeamColor } from "@/lib/person-colors";
import { targetPerMonth, type HealthRow } from "@/lib/health-settings";
import type { Assignment } from "@/lib/types";

const DAY = 24 * 60 * 60 * 1000;

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function monthKey(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/** For each date, position within its consecutive-week run and the run length. */
function runInfo(dates: string[]) {
  const set = new Set(dates);
  const info = new Map<string, { index: number; length: number }>();
  for (const d of dates) {
    if (info.has(d)) continue;
    const prev = iso(new Date(new Date(d + "T00:00:00").getTime() - 7 * DAY));
    if (set.has(prev)) continue; // not the start of a run
    // walk the run forward
    const run: string[] = [d];
    let cur = d;
    while (true) {
      const next = iso(new Date(new Date(cur + "T00:00:00").getTime() + 7 * DAY));
      if (!set.has(next)) break;
      run.push(next);
      cur = next;
    }
    run.forEach((r, i) => info.set(r, { index: i + 1, length: run.length }));
  }
  return info;
}

interface Props {
  row: HealthRow | null;
  onOpenChange: (open: boolean) => void;
}

export function VolunteerHistoryDrawer({ row, onOpenChange }: Props) {
  const assignments = useRoster((s) => s.assignments);
  const subTeams = useRoster((s) => s.subTeams);
  const [showAllHistory, setShowAllHistory] = useState(false);

  const subTeamMap = useMemo(() => {
    const map = new Map<string, { name: string; color: ReturnType<typeof resolveSubTeamColor> }>();
    for (const r of subTeams) {
      if (!r.person_name?.trim() || !r.slot_label?.trim()) continue;
      map.set(`${r.slot_label}||${r.person_name.trim().toLowerCase()}`, {
        name: r.sub_team_name,
        color: resolveSubTeamColor(r.serving_area, r.sub_team_name, r.color),
      });
    }
    return map;
  }, [subTeams]);

  const data = useMemo(() => {
    if (!row) return null;
    const name = row.volunteer.full_name.trim().toLowerCase();
    const mine = assignments
      .filter((a) => a.person_name.trim().toLowerCase() === name)
      .sort((a, b) => a.date.localeCompare(b.date));

    const today = iso(new Date());
    const past = mine.filter((a) => a.date < today).reverse();
    const upcoming = mine.filter((a) => a.date >= today);

    const runs = runInfo(Array.from(new Set(mine.map((a) => a.date))));

    const now = Date.now();
    const in4 = upcoming.filter(
      (a) => new Date(a.date + "T00:00:00").getTime() <= now + 28 * DAY,
    ).length;
    const last4 = past.filter(
      (a) => new Date(a.date + "T00:00:00").getTime() >= now - 28 * DAY,
    ).length;

    const byArea = new Map<string, number>();
    mine.forEach((a) => byArea.set(a.area, (byArea.get(a.area) ?? 0) + 1));

    const cutoff = iso(new Date(now - 84 * DAY));
    return {
      mine,
      past,
      upcoming,
      runs,
      in4,
      last4,
      byArea: Array.from(byArea.entries()).sort((a, b) => b[1] - a[1]),
      cutoff,
    };
  }, [row, assignments]);

  const renderList = (items: Assignment[]) => {
    const groups: { month: string; items: Assignment[] }[] = [];
    for (const a of items) {
      const m = monthKey(a.date);
      const last = groups[groups.length - 1];
      if (last && last.month === m) last.items.push(a);
      else groups.push({ month: m, items: [a] });
    }
    return groups.map((g) => (
      <div key={g.month} className="space-y-1.5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {g.month}
        </div>
        {g.items.map((a) => {
          const st = subTeamMap.get(`${a.label}||${a.person_name.trim().toLowerCase()}`);
          const run = data?.runs.get(a.date);
          return (
            <div
              key={a.id}
              className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full border"
                style={{
                  backgroundColor: st?.color.bg ?? "hsl(var(--muted))",
                  borderColor: st?.color.border ?? "hsl(var(--border))",
                }}
              />
              <span className="w-[92px] shrink-0 tabular-nums text-muted-foreground">
                {fmtDate(a.date)}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {a.area}
                {a.role ? <span className="text-muted-foreground"> — {a.role}</span> : null}
              </span>
              {run && run.length > 1 && (
                <span className="shrink-0 rounded-full bg-status-amber px-2 py-0.5 text-[10px] text-status-amber-foreground">
                  wk {run.index}/{run.length}
                </span>
              )}
              {a.status && a.status !== "pending" && (
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {a.status}
                </span>
              )}
            </div>
          );
        })}
      </div>
    ));
  };

  return (
    <Sheet open={!!row} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {row && data && (
          <>
            <SheetHeader className="space-y-2">
              <SheetTitle className="flex items-center gap-2">
                {row.volunteer.full_name}
                <StatusBadge status={row.status} />
              </SheetTitle>
              <SheetDescription>
                {row.volunteer.serving_areas.join(", ") || "No serving areas set"}
                {row.volunteer.is_paused ? " · Paused" : ""}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Total serves", value: data.mine.length },
                { label: "Last 4 wks", value: data.last4 },
                { label: "Next 4 wks", value: data.in4 },
                { label: "Longest streak", value: `${row.streak || 0}w` },
              ].map((k) => (
                <div key={k.label} className="rounded-lg border bg-card p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {k.label}
                  </div>
                  <div className="mt-1 text-xl font-semibold tabular-nums">{k.value}</div>
                </div>
              ))}
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Preferred load: {targetPerMonth(row.volunteer)} / month
              {row.volunteer.frequency_preference
                ? ` (${row.volunteer.frequency_preference})`
                : ""}
            </p>

            {data.byArea.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {data.byArea.map(([a, n]) => `${a} ${n}`).join(" · ")}
              </p>
            )}

            {data.mine.length === 0 ? (
              <div className="mt-8 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No assignments on the roster for {row.volunteer.full_name} yet.
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">
                    Upcoming{" "}
                    <span className="text-muted-foreground">({data.upcoming.length})</span>
                  </h3>
                  {data.upcoming.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nothing rostered ahead.</p>
                  ) : (
                    renderList(data.upcoming)
                  )}
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">
                      History <span className="text-muted-foreground">({data.past.length})</span>
                    </h3>
                    {data.past.some((a) => a.date < data.cutoff) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAllHistory((v) => !v)}
                      >
                        {showAllHistory ? "Show last 12 weeks" : "Show all history"}
                      </Button>
                    )}
                  </div>
                  {data.past.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No past assignments.</p>
                  ) : (
                    renderList(
                      showAllHistory ? data.past : data.past.filter((a) => a.date >= data.cutoff),
                    )
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
