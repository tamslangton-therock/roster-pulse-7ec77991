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
          "Interactive Sunday roster grid with clash detection, status badges, paused-member alerts, and smart swaps.",
      },
      { property: "og:title", content: "Live Roster — Roster Pulse" },
      {
        property: "og:description",
        content:
          "Interactive Sunday roster grid with clash detection, status badges, paused-member alerts, and smart swaps.",
      },
    ],
  }),
  component: LiveRosterPage,
});

type AssignmentStatus = "pending" | "reminder_sent" | "declined" | "confirmed";

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

  // Local state map to track assignment status updates per assignment ID
  const [statuses, setStatuses] = useState<Record<string, AssignmentStatus>>({});

  const handleStatusChange = (assignmentId: string, status: AssignmentStatus) => {
    setStatuses((prev) => ({ ...prev, [assignmentId]: status }));
    const labels: Record<AssignmentStatus, string> = {
      pending: "Pending",
      reminder_sent: "Reminder Sent",
      declined: "Declined",
      confirmed: "Confirmed",
    };
    toast.info(`Updated status to ${labels[status]}`);
  };

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

  const todayStr = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  const shownDates = useMemo(() => {
    return dates.filter((d) => {
      const matchesMonth = filterMonth === "all" || d.startsWith(filterMonth);
      if (!matchesMonth) return false;

      if (hidePastWeeks && d < todayStr) return false;

      return true;
    });
  }, [dates, filterMonth, hidePastWeeks, todayStr]);

  const pausedNames = useMemo(
    () => new Set(volunteers.filter((v) => v.is_paused).map((v) => v.full_name.toLowerCase())),
    [volunteers],
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
                    className="border-b p-2 text-left font-medium text-xs text-muted-foreground min-w-[150px] whitespace-nowrap"
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shownDates.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="text-center py-8 text-muted-foreground">
                    No Sundays match the current filters.
                  </td>
                </tr>
              ) : (
                shownDates.map((d) => {
                  const rowHasClash = clashes.some((c) => c.date === d);
                  if (showClashesOnly && !rowHasClash) return null;
                  return (
                    <tr key={d} className="hover:bg-muted/30">
                      <td className="sticky left-0 z-10 bg-card border-b border-r p-3 font-medium whitespace-nowrap">
                        <div className="flex flex-col">
                          <span>{format(parseISO(`${d}T12:00:00`), "d MMM")}</span>
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
                                const paused = pausedNames.has(a.person_name.toLowerCase());
                                const isClash = clashKey.has(
                                  `${a.date}||${a.person_name.toLowerCase()}`,
                                );
                                const overridden = clashKey.get(
                                  `${a.date}||${a.person_name.toLowerCase()}`,
                                );
                                const status = statuses[a.id] || "pending";

                                return (
                                  <RosterCellBadge
                                    key={a.id}
                                    assignment={a}
                                    status={status}
                                    paused={paused}
                                    isClash={isClash}
                                    overridden={overridden}
                                    onStatusChange={(newStatus) =>
                                      handleStatusChange(a.id, newStatus)
                                    }
                                    onSelectSwap={() => setSwapTarget(a)}
                                    onSelectClash={() => {
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
 * Custom Roster Cell Badge Component
 * Handles status color switching (Gray, Yellow, Red, Green)
 * and direct replacement triggers.
 */
function RosterCellBadge({
  assignment,
  status,
  paused,
  isClash,
  overridden,
  onStatusChange,
  onSelectSwap,
  onSelectClash,
}: {
  assignment: Assignment;
  status: AssignmentStatus;
  paused: boolean;
  isClash: boolean;
  overridden?: boolean;
  onStatusChange: (status: AssignmentStatus) => void;
  onSelectSwap: () => void;
  onSelectClash: () => void;
}) {
  // Determine badge styling based on priority: Paused / Clash > Status
  const getBadgeStyle = () => {
    if (paused) return "bg-status-amber text-status-amber-foreground border-amber-300";
    if (isClash && !overridden)
      return "bg-status-red text-status-red-foreground border-red-300";
    if (isClash && overridden)
      return "bg-status-blue text-status-blue-foreground border-blue-300";

    switch (status) {
      case "reminder_sent":
        return "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200";
      case "declined":
        return "bg-red-100 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-200";
      case "confirmed":
        return "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200";
      case "pending":
      default:
        return "bg-muted text-muted-foreground border-border hover:bg-accent/80";
    }
  };

  const getStatusIcon = () => {
    if (paused) return <Pause className="h-3 w-3" />;
    if (isClash) return <AlertTriangle className="h-3 w-3" />;

    switch (status) {
      case "reminder_sent":
        return <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />;
      case "declined":
        return <XCircle className="h-3 w-3 text-red-600 dark:text-red-400" />;
      case "confirmed":
        return <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />;
      case "pending":
      default:
        return <HelpCircle className="h-3 w-3 opacity-60" />;
    }
  };

  return (
    <div
      className={cn(
        "group relative flex items-center justify-between rounded-md border px-2 py-1 text-xs transition shadow-xs",
        getBadgeStyle(),
      )}
    >
      {/* Click main body to swap or inspect clash */}
      <button
        type="button"
        onClick={() => {
          if (isClash && !overridden) {
            onSelectClash();
          } else {
            onSelectSwap();
          }
        }}
        className="flex-1 text-left font-medium truncate flex items-center gap-1.5 focus:outline-hidden"
      >
        {getStatusIcon()}
        <span className="truncate">{assignment.person_name}</span>
      </button>

      {/* Quick Status Switcher Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity ml-1 p-0.5 rounded-xs hover:bg-black/10 dark:hover:bg-white/10"
            title="Change status"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem onClick={() => onStatusChange("pending")}>
            <HelpCircle className="h-3.5 w-3.5 mr-2 opacity-60" />
            Pending (Gray)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onStatusChange("reminder_sent")}>
            <Clock className="h-3.5 w-3.5 mr-2 text-amber-500" />
            Reminder (Yellow)
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              onStatusChange("declined");
              onSelectSwap(); // Prompt smart swap automatically if declined
            }}
          >
            <XCircle className="h-3.5 w-3.5 mr-2 text-red-500" />
            Declined (Red)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onStatusChange("confirmed")}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-emerald-500" />
            Confirmed (Green)
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
                {target.label} · {format(parseISO(`${target.date}T12:00:00`), "EEE d MMM yyyy")} · Replacing{" "}
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
                <AlertTriangle className="h-4 w-4 text-status-red-foreground" />
                Clash — {detail.person}
              </DialogTitle>
              <DialogDescription>
                {format(parseISO(`${detail.date}T12:00:00`), "EEEE d MMMM yyyy")} · assigned to{" "}
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
