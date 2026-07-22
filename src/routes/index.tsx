import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import {
  AlertTriangle,
  Filter,
  Pause,
  RefreshCcw,
  Eye,
  EyeOff,
  CheckCircle2,
  Clock,
  XCircle,
  HelpCircle,
  ChevronDown,
  Layers,
} from "lucide-react";
import { useRoster, findVolunteer } from "@/lib/store";
import {
  assignmentsByCell,
  detectClashes,
  rankSwapCandidates,
} from "@/lib/roster-engine";
import type { Assignment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Live Roster — Roster Pulse" },
      {
        name: "description",
        content:
          "Interactive Sunday roster grid with status switcher, clash detection, and smart swaps.",
      },
    ],
  }),
  component: LiveRosterPage,
});

export type AssignmentStatus =
  | "pending"
  | "reminder_sent"
  | "declined"
  | "confirmed";

interface VolunteerWorkloadStats {
  total: number;
  clashDates: Set<string>;
}

function LiveRosterPage() {
  const { volunteers, assignments, dates } = useRoster();
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [showClashesOnly, setShowClashesOnly] = useState(false);
  const [hidePastWeeks, setHidePastWeeks] = useState(true);
  const [swapTarget, setSwapTarget] = useState<Assignment | null>(null);
  const [clashDetail, setClashDetail] = useState<{
    date: string;
    person: string;
    items: Assignment[];
  } | null>(null);

  // Status mapping stored by assignment ID
  const [statusMap, setStatusMap] = useState<Record<string, AssignmentStatus>>(
    {}
  );

  const setAssignmentStatus = (id: string, status: AssignmentStatus) => {
    setStatusMap((prev) => ({ ...prev, [id]: status }));
    const labels: Record<AssignmentStatus, string> = {
      pending: "Pending",
      reminder_sent: "Reminder Sent",
      declined: "Declined",
      confirmed: "Confirmed",
    };
    toast.success(`Set status to ${labels[status]}`);
  };

  const cellMap = useMemo(() => assignmentsByCell(assignments), [assignments]);
  const clashes = useMemo(() => detectClashes(assignments), [assignments]);

  const clashKey = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const c of clashes)
      m.set(`${c.date}||${c.person.toLowerCase()}`, c.is_override);
    return m;
  }, [clashes]);

  const columns = useMemo(() => {
    const seen = new Map<string, { area: string; label: string }>();
    for (const a of assignments) {
      if (!seen.has(a.label)) seen.set(a.label, { area: a.area, label: a.label });
    }
    return Array.from(seen.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [assignments]);

  const months = useMemo(() => {
    const s = new Set<string>();
    for (const d of dates) s.add(d.slice(0, 7));
    return Array.from(s).sort();
  }, [dates]);

  const todayStr = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  const shownDates = useMemo(() => {
    return dates.filter((d) => {
      const matchesMonth = filterMonth === "all" || d.startsWith(filterMonth);
      if (!matchesMonth) return false;
      if (hidePastWeeks && d < todayStr) return false;
      return true;
    });
  }, [dates, filterMonth, hidePastWeeks, todayStr]);

  // 1. Calculate volunteer workload stats and multi-row double-booking clashes across visible range
  const volunteerStatsMap = useMemo(() => {
    const map = new Map<string, VolunteerWorkloadStats>();
    const visibleDatesSet = new Set(shownDates);
    const volDateCounts = new Map<string, Map<string, number>>();

    for (const a of assignments) {
      if (!visibleDatesSet.has(a.date)) continue;
      const key = a.person_name.toLowerCase();

      if (!map.has(key)) {
        map.set(key, { total: 0, clashDates: new Set() });
      }
      const stat = map.get(key)!;
      stat.total += 1;

      if (!volDateCounts.has(key)) {
        volDateCounts.set(key, new Map());
      }
      const dateMap = volDateCounts.get(key)!;
      const currentCount = (dateMap.get(a.date) || 0) + 1;
      dateMap.set(a.date, currentCount);

      if (currentCount > 1) {
        stat.clashDates.add(a.date);
      }
    }

    return map;
  }, [assignments, shownDates]);

  // Count distinct double-booked volunteers
  const doubleBookedVolunteersCount = useMemo(() => {
    let count = 0;
    for (const stat of volunteerStatsMap.values()) {
      if (stat.clashDates.size > 0) count++;
    }
    return count;
  }, [volunteerStatsMap]);

  const pausedNames = useMemo(
    () =>
      new Set(
        volunteers
          .filter((v) => v.is_paused)
          .map((v) => v.full_name.toLowerCase())
      ),
    [volunteers]
  );

  return (
    <div className="p-6 space-y-6">
      {/* Top Header Section */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Live Roster</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {shownDates.length} Sundays · {assignments.length} assignments ·{" "}
            <span className="text-red-500 font-medium">{clashes.length} clashes</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
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
                    {format(parseISO(`${m}-01T12:00:00`), "MMMM yyyy")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <Checkbox
              checked={hidePastWeeks}
              onCheckedChange={(v) => setHidePastWeeks(!!v)}
            />
            <span className="flex items-center gap-1">
              {hidePastWeeks ? (
                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              Hide past weeks
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <Checkbox
              checked={showClashesOnly}
              onCheckedChange={(v) => setShowClashesOnly(!!v)}
            />
            Clashes only
          </label>
        </div>
      </div>

      {/* 2. Roster Capacity & Health Summary Banner */}
      <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "p-2 rounded-lg flex items-center justify-center",
              doubleBookedVolunteersCount > 0
                ? "bg-red-500/10 text-red-600 dark:text-red-400"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            )}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Roster Capacity & Health</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {doubleBookedVolunteersCount === 0
                ? "All active volunteers have clear single assignments across scheduled dates."
                : `${doubleBookedVolunteersCount} volunteer${
                    doubleBookedVolunteersCount > 1 ? "s have" : " has"
                  } multi-role double-bookings.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1 rounded-full border bg-muted/50 font-medium">
            Double-Booked Volunteers:{" "}
            <strong
              className={
                doubleBookedVolunteersCount > 0
                  ? "text-red-600 dark:text-red-400 font-bold"
                  : "text-emerald-600 dark:text-emerald-400 font-bold"
              }
            >
              {doubleBookedVolunteersCount}
            </strong>
          </span>
        </div>
      </div>

      {/* Table Section */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <div className="overflow-auto max-h-[calc(100vh-280px)]">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10">
              <tr>
                <th className="sticky left-0 z-20 bg-muted border-b border-r p-3 text-left font-medium w-[140px]">
                  Date
                </th>
                {columns.map((c) => (
                  <th
                    key={c.label}
                    className="border-b p-2 text-left font-medium text-xs text-muted-foreground min-w-[160px] whitespace-nowrap"
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shownDates.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No Sundays match the current filters.
                  </td>
                </tr>
              ) : (
                shownDates.map((d) => {
                  const rowHasClash = clashes.some((c) => c.date === d);
                  if (showClashesOnly && !rowHasClash) return null;
                  return (
                    <tr key={d} className="hover:bg-muted/20">
                      <td className="sticky left-0 z-10 bg-card border-b border-r p-3 font-medium whitespace-nowrap">
                        <div className="flex flex-col">
                          <span>
                            {format(parseISO(`${d}T12:00:00`), "d MMM")}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {format(parseISO(`${d}T12:00:00`), "EEEE")}
                          </span>
                        </div>
                      </td>
                      {columns.map((c) => {
                        const list = cellMap.get(`${d}||${c.label}`) || [];
                        return (
                          <td key={c.label} className="border-b p-2 align-top">
                            <div className="flex flex-col gap-1.5">
                              {list.map((a) => {
                                const key = a.person_name.toLowerCase();
                                const stats = volunteerStatsMap.get(key) || {
                                  total: 0,
                                  clashDates: new Set(),
                                };
                                const paused = pausedNames.has(key);
                                const isClash = clashKey.has(`${a.date}||${key}`);
                                const overridden = clashKey.get(`${a.date}||${key}`);
                                const isDoubleBookedOnDate = stats.clashDates.has(a.date);
                                const currentStatus: AssignmentStatus =
                                  statusMap[a.id] ||
                                  (a as any).status ||
                                  "pending";

                                return (
                                  <StatusCellBadge
                                    key={a.id}
                                    assignment={a}
                                    status={currentStatus}
                                    paused={paused}
                                    isClash={isClash}
                                    overridden={overridden}
                                    totalWorkload={stats.total}
                                    clashDatesCount={stats.clashDates.size}
                                    isDoubleBookedOnDate={isDoubleBookedOnDate}
                                    onStatusChange={(s) =>
                                      setAssignmentStatus(a.id, s)
                                    }
                                    onSelectSwap={() => setSwapTarget(a)}
                                    onSelectClash={() => {
                                      const items = assignments.filter(
                                        (x) =>
                                          x.date === a.date &&
                                          x.person_name.toLowerCase() === key
                                      );
                                      setClashDetail({
                                        date: a.date,
                                        person: a.person_name,
                                        items,
                                      });
                                    }}
                                  />
                                );
                              })}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SwapDialog target={swapTarget} onClose={() => setSwapTarget(null)} />
      <ClashDialog detail={clashDetail} onClose={() => setClashDetail(null)} />
    </div>
  );
}

/**
 * High-Visibility Status Badge with Workload & Double-Booking Highlights
 */
function StatusCellBadge({
  assignment,
  status,
  paused,
  isClash,
  overridden,
  totalWorkload,
  clashDatesCount,
  isDoubleBookedOnDate,
  onStatusChange,
  onSelectSwap,
  onSelectClash,
}: {
  assignment: Assignment;
  status: AssignmentStatus;
  paused: boolean;
  isClash: boolean;
  overridden?: boolean;
  totalWorkload: number;
  clashDatesCount: number;
  isDoubleBookedOnDate: boolean;
  onStatusChange: (status: AssignmentStatus) => void;
  onSelectSwap: () => void;
  onSelectClash: () => void;
}) {
  const getBadgeStyle = () => {
    if (paused) {
      return "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40";
    }
    if (isClash && !overridden) {
      return "bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/40";
    }
    if (isClash && overridden) {
      return "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/40";
    }
    switch (status) {
      case "reminder_sent":
        return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200";
      case "declined":
        return "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-200";
      case "confirmed":
        return "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200";
      case "pending":
      default:
        return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const getIcon = () => {
    if (paused) return <Pause className="h-3 w-3 text-amber-600" />;
    if (isClash) return <AlertTriangle className="h-3 w-3 text-red-600" />;
    switch (status) {
      case "reminder_sent":
        return <Clock className="h-3 w-3 text-amber-600" />;
      case "declined":
        return <XCircle className="h-3 w-3 text-red-600" />;
      case "confirmed":
        return <CheckCircle2 className="h-3 w-3 text-emerald-600" />;
      case "pending":
      default:
        return <HelpCircle className="h-3 w-3 text-gray-400" />;
    }
  };

  return (
    <div
      className={cn(
        "group flex items-center justify-between rounded-md border px-2 py-1 text-xs transition-colors shadow-xs",
        getBadgeStyle(),
        // 4. Highlight cells where the volunteer is double-booked on that date
        isDoubleBookedOnDate && "ring-2 ring-red-500/60 bg-red-500/15"
      )}
    >
      <button
        type="button"
        onClick={() => {
          if (isClash && !overridden) {
            onSelectClash();
          } else {
            onSelectSwap();
          }
        }}
        className="flex-1 text-left font-medium truncate flex items-center gap-1.5 focus:outline-hidden cursor-pointer"
      >
        {getIcon()}
        <span className="truncate">{assignment.person_name}</span>

        {/* 3. Red double-booking alert badge if double-booked across dates */}
        {clashDatesCount > 0 && (
          <span
            className="flex items-center gap-0.5 px-1 py-0.2 text-[10px] rounded-full bg-red-600 text-white font-bold shrink-0"
            title={`Double-booked on ${clashDatesCount} date${
              clashDatesCount > 1 ? "s" : ""
            }`}
          >
            <AlertTriangle className="h-2.5 w-2.5" />
            {clashDatesCount}
          </span>
        )}

        {/* 3. Workload capacity badge showing total shift count */}
        <span
          className="flex items-center gap-0.5 px-1.5 py-0.2 text-[10px] rounded-md bg-black/10 dark:bg-white/15 font-mono text-muted-foreground dark:text-gray-200 shrink-0"
          title={`Assigned ${totalWorkload} shift(s) across visible range`}
        >
          <Layers className="h-2.5 w-2.5 opacity-70" />
          {totalWorkload}
        </span>
      </button>

      {/* Dropdown Menu for Status Switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="ml-1 p-0.5 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 transition-opacity cursor-pointer"
            title="Change status"
          >
            <ChevronDown className="h-3 w-3 opacity-60 group-hover:opacity-100" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40 z-50">
          <DropdownMenuItem onClick={() => onStatusChange("pending")}>
            <HelpCircle className="h-3.5 w-3.5 mr-2 text-gray-400" />
            <span>Gray: Pending</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onStatusChange("reminder_sent")}>
            <Clock className="h-3.5 w-3.5 mr-2 text-amber-500" />
            <span>Yellow: Reminder</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              onStatusChange("declined");
              onSelectSwap();
            }}
          >
            <XCircle className="h-3.5 w-3.5 mr-2 text-red-500" />
            <span>Red: Declined</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onStatusChange("confirmed")}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-emerald-500" />
            <span>Green: Confirmed</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
  const { volunteers, assignments, swapAssignment, removeAssignment } =
    useRoster();
  const candidates = useMemo(() => {
    if (!target) return [];
    return rankSwapCandidates(target, volunteers, assignments);
  }, [target, volunteers, assignments]);

  const targetVol = target
    ? findVolunteer(volunteers, target.person_name)
    : undefined;
  const partnerNames = targetVol?.partners ?? [];

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        {target && (
          <>
            <DialogHeader>
              <DialogTitle>Smart Swap</DialogTitle>
              <DialogDescription>
                {target.label} ·{" "}
                {format(parseISO(`${target.date}T12:00:00`), "EEE d MMM yyyy")} ·
                Replacing{" "}
                <span className="font-medium text-foreground">
                  {target.person_name}
                </span>
              </DialogDescription>
            </DialogHeader>
            {partnerNames.length > 0 && (
              <div className="rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300 p-3 text-xs">
                Partner link: <b>{partnerNames.join(", ")}</b> — consider
                rostering together.
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
          a.person_name.toLowerCase() === detail.person.toLowerCase()
      )
    : [];
  const allOverride =
    live.length > 0 && live.every((a) => a.is_override);

  useEffect(() => {
    if (detail && live.length === 0) {
      onClose();
    }
  }, [detail, live.length, onClose]);

  return (
    <Dialog open={!!detail} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        {detail && live.length > 0 && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" /> Clash —{" "}
                {detail.person}
              </DialogTitle>
              <DialogDescription>
                {format(parseISO(`${detail.date}T12:00:00`), "EEEE d MMMM yyyy")} ·
                assigned to {live.length} roles
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
