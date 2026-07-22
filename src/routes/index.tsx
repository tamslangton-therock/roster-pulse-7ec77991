import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { AlertTriangle, Filter, Pause, RefreshCcw, UserPlus, Users } from "lucide-react";

import { useRoster, findVolunteer } from "@/lib/store";
import {
  assignmentsByCell,
  detectClashes,
  rankSwapCandidates,
} from "@/lib/roster-engine";
import type { Assignment } from "@/lib/types";
import { ToneBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Live Roster — Roster Pulse" },
      {
        name: "description",
        content:
          "Interactive Sunday roster grid with clash detection, paused-member alerts, and one-click smart swaps.",
      },
      { property: "og:title", content: "Live Roster — Roster Pulse" },
      {
        property: "og:description",
        content:
          "Interactive Sunday roster grid with clash detection, paused-member alerts, and one-click smart swaps.",
      },
    ],
  }),
  component: LiveRosterPage,
});

function LiveRosterPage() {
  const { volunteers, assignments, dates } = useRoster();
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [showClashesOnly, setShowClashesOnly] = useState(false);
  const [swapTarget, setSwapTarget] = useState<Assignment | null>(null);
  const [clashDetail, setClashDetail] = useState<{
    date: string;
    person: string;
    items: Assignment[];
  } | null>(null);

  const cellMap = useMemo(() => assignmentsByCell(assignments), [assignments]);
  const clashes = useMemo(() => detectClashes(assignments), [assignments]);
  const clashKey = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const c of clashes) m.set(`${c.date}||${c.person.toLowerCase()}`, c.is_override);
    return m;
  }, [clashes]);

  const columns = useMemo(() => {
    const seen = new Map<string, { area: string; label: string }>();
    for (const a of assignments) {
      if (!seen.has(a.label)) seen.set(a.label, { area: a.area, label: a.label });
    }
    return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [assignments]);

  const months = useMemo(() => {
    const s = new Set<string>();
    for (const d of dates) s.add(d.slice(0, 7));
    return Array.from(s).sort();
  }, [dates]);

  const shownDates = dates.filter((d) => filterMonth === "all" || d.startsWith(filterMonth));

  const pausedNames = new Set(
    volunteers.filter((v) => v.is_paused).map((v) => v.full_name.toLowerCase()),
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Live Roster</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {shownDates.length} Sundays · {assignments.length} assignments ·{" "}
            <span className="text-status-red-foreground font-medium">{clashes.length} clashes</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All months" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {months.map((m) => (
                  <SelectItem key={m} value={m}>
                    {format(parseISO(m + "-01"), "MMMM yyyy")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={showClashesOnly}
              onCheckedChange={(v) => setShowClashesOnly(!!v)}
            />
            Clashes only
          </label>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <div className="overflow-auto max-h-[calc(100vh-220px)]">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-muted/60 backdrop-blur z-10">
              <tr>
                <th className="sticky left-0 z-20 bg-muted/80 backdrop-blur border-b border-r p-3 text-left font-medium w-[140px]">
                  Date
                </th>
                {columns.map((c) => (
                  <th
                    key={c.label}
                    className="border-b p-2 text-left font-medium text-xs text-muted-foreground min-w-[140px] whitespace-nowrap"
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shownDates.map((d) => {
                const rowHasClash = clashes.some((c) => c.date === d);
                if (showClashesOnly && !rowHasClash) return null;
                return (
                  <tr key={d} className="hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-card border-b border-r p-3 font-medium whitespace-nowrap">
                      <div className="flex flex-col">
                        <span>{format(parseISO(d), "d MMM")}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {format(parseISO(d), "EEEE")}
                        </span>
                      </div>
                    </td>
                    {columns.map((c) => {
                      const list = cellMap.get(`${d}||${c.label}`) || [];
                      return (
                        <td key={c.label} className="border-b p-2 align-top">
                          <div className="flex flex-col gap-1">
                            {list.map((a) => {
                              const paused = pausedNames.has(a.person_name.toLowerCase());
                              const isClash = clashKey.has(
                                `${a.date}||${a.person_name.toLowerCase()}`,
                              );
                              const overridden = clashKey.get(
                                `${a.date}||${a.person_name.toLowerCase()}`,
                              );
                              return (
                                <button
                                  key={a.id}
                                  onClick={() => {
                                    if (isClash) {
                                      const items = assignments.filter(
                                        (x) =>
                                          x.date === a.date &&
                                          x.person_name.toLowerCase() ===
                                            a.person_name.toLowerCase(),
                                      );
                                      setClashDetail({
                                        date: a.date,
                                        person: a.person_name,
                                        items,
                                      });
                                    } else {
                                      setSwapTarget(a);
                                    }
                                  }}
                                  className={cn(
                                    "text-left rounded-md px-2 py-1 text-xs transition border border-transparent",
                                    paused
                                      ? "bg-status-amber text-status-amber-foreground"
                                      : isClash && !overridden
                                        ? "bg-status-red text-status-red-foreground"
                                        : isClash && overridden
                                          ? "bg-status-blue text-status-blue-foreground"
                                          : "bg-muted hover:bg-accent",
                                  )}
                                  title={
                                    paused
                                      ? "Paused — needs replacement"
                                      : isClash
                                        ? "Clash detected"
                                        : "Click to swap"
                                  }
                                >
                                  <div className="flex items-center gap-1 font-medium">
                                    {paused && <Pause className="h-3 w-3" />}
                                    {isClash && <AlertTriangle className="h-3 w-3" />}
                                    <span className="truncate">{a.person_name}</span>
                                  </div>
                                  {paused && (
                                    <div className="text-[10px] opacity-80 mt-0.5">
                                      Needs replacement
                                    </div>
                                  )}
                                  {isClash && (
                                    <div className="text-[10px] opacity-80 mt-0.5">
                                      {overridden ? "Exception allowed" : "Clash alert"}
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <SwapDialog target={swapTarget} onClose={() => setSwapTarget(null)} />
      <ClashDialog detail={clashDetail} onClose={() => setClashDetail(null)} />
    </div>
  );
}

function SwapDialog({
  target,
  onClose,
}: {
  target: Assignment | null;
  onClose: () => void;
}) {
  const { volunteers, assignments, swapAssignment, removeAssignment } = useRoster();
  const candidates = useMemo(() => {
    if (!target) return [];
    return rankSwapCandidates(target, volunteers, assignments);
  }, [target, volunteers, assignments]);

  const targetVol = target ? findVolunteer(volunteers, target.person_name) : undefined;
  const partnerNames = targetVol?.partners ?? [];

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        {target && (
          <>
            <DialogHeader>
              <DialogTitle>Smart Swap</DialogTitle>
              <DialogDescription>
                {target.label} · {format(parseISO(target.date), "EEE d MMM yyyy")} · Replacing{" "}
                <span className="font-medium text-foreground">{target.person_name}</span>
              </DialogDescription>
            </DialogHeader>

            {partnerNames.length > 0 && (
              <div className="rounded-lg bg-status-blue/50 text-status-blue-foreground p-3 text-xs">
                Partner link: <b>{partnerNames.join(", ")}</b> — consider rostering together.
              </div>
            )}

            <div className="space-y-2 max-h-[360px] overflow-auto -mx-1 px-1">
              {candidates.length === 0 && (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  No qualified replacements available.
                </div>
              )}
              {candidates.map((c) => (
                <div
                  key={c.volunteer.id}
                  className="flex items-center justify-between rounded-lg border bg-card px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">
                      {c.volunteer.full_name}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {c.reasons.join(" · ")}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      swapAssignment(target.id, c.volunteer.full_name);
                      toast.success(`Swapped in ${c.volunteer.full_name}`);
                      onClose();
                    }}
                  >
                    <RefreshCcw className="h-3 w-3 mr-1" /> Swap
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  removeAssignment(target.id);
                  toast.info("Slot cleared");
                  onClose();
                }}
              >
                Clear slot
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ClashDialog({
  detail,
  onClose,
}: {
  detail: { date: string; person: string; items: Assignment[] } | null;
  onClose: () => void;
}) {
  const { assignments, setOverride, removeAssignment } = useRoster();
  const live = detail
    ? assignments.filter(
        (a) =>
          a.date === detail.date &&
          a.person_name.toLowerCase() === detail.person.toLowerCase(),
      )
    : [];
  const allOverride = live.length > 0 && live.every((a) => a.is_override);

  return (
    <Dialog open={!!detail} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        {detail && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-status-red-foreground" />
                Clash — {detail.person}
              </DialogTitle>
              <DialogDescription>
                {format(parseISO(detail.date), "EEEE d MMMM yyyy")} · assigned to{" "}
                {live.length} roles
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              {live.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <span>{a.label}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAssignment(a.id)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>

            <label className="flex items-center gap-2 pt-2 text-sm">
              <Checkbox
                checked={allOverride}
                onCheckedChange={(v) => {
                  live.forEach((a) => setOverride(a.id, !!v));
                }}
              />
              Allow as exception (double-booking approved)
            </label>

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Suppress unused import warnings for icons planned for later
void UserPlus;
void ToneBadge;
void Users;
