import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { z } from "zod";
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
  Printer,
  Share2,
  Users,
  CalendarX,
  Plus,
  Trash2,
  Calendar as CalendarIcon,
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
import { Input } from "@/components/ui/input";
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

// Zod schema for URL search parameters
const rosterSearchSchema = z.object({
  team: z.string().optional().default("all"),
  month: z.string().optional().default("all"),
  view: z.enum(["edit", "share"]).optional().default("edit"),
});

export const Route = createFileRoute("/")({
  validateSearch: (search) => rosterSearchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Live Roster — Roster Pulse" },
      {
        name: "description",
        content:
          "Interactive Sunday roster grid with blackout date management, clash detection, and smart swaps.",
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
  blackoutClashDates: Set<string>;
}

function LiveRosterPage() {
  const navigate = useNavigate({ from: Route.id });
  const search = Route.useSearch();

  const { volunteers, assignments, dates } = useRoster();

  // URL State
  const selectedTeam = search.team || "all";
  const filterMonth = search.month || "all";
  const isShareView = search.view === "share";

  // Local UI State
  const [showClashesOnly, setShowClashesOnly] = useState(false);
  const [hidePastWeeks, setHidePastWeeks] = useState(true);
  const [swapTarget, setSwapTarget] = useState<Assignment | null>(null);
  const [clashDetail, setClashDetail] = useState<{
    date: string;
    person: string;
    items: Assignment[];
    isBlackout?: boolean;
  } | null>(null);

  // Volunteer Blackout Date State: lowercased volunteer name -> Set<"YYYY-MM-DD">
  const [blackoutsMap, setBlackoutsMap] = useState<Record<string, Set<string>>>({
    "john doe": new Set(["2026-08-02", "2026-08-16"]),
    "jane smith": new Set(["2026-08-09"]),
  });

  // Active Volunteer selected for Unavailability Management
  const [selectedVolunteerForBlackouts, setSelectedVolunteerForBlackouts] =
    useState<{ id: string; name: string } | null>(null);

  const toggleBlackoutDate = (volunteerName: string, dateStr: string) => {
    const key = volunteerName.toLowerCase();
    setBlackoutsMap((prev) => {
      const currentSet = new Set(prev[key] || []);
      if (currentSet.has(dateStr)) {
        currentSet.delete(dateStr);
        toast.info(`Removed blackout date ${dateStr} for ${volunteerName}`);
      } else {
        currentSet.add(dateStr);
        toast.success(`Blocked out ${dateStr} for ${volunteerName}`);
      }
      return { ...prev, [key]: currentSet };
    });
  };

  const [statusMap, setStatusMap] = useState<Record<string, AssignmentStatus>>({});

  const updateSearchParams = (
    updates: Partial<z.infer<typeof rosterSearchSchema>>
  ) => {
    navigate({
      search: (prev) => ({
        ...prev,
        ...updates,
      }),
      replace: true,
    });
  };

  const setAssignmentStatus = (id: string, status: AssignmentStatus) => {
    setStatusMap((prev) => ({ ...prev, [id]: status }));
  };

  const availableTeams = useMemo(() => {
    const teams = new Set<string>();
    for (const a of assignments) {
      if (a.area) teams.add(a.area);
    }
    return Array.from(teams).sort();
  }, [assignments]);

  const filteredAssignments = useMemo(() => {
    if (selectedTeam === "all") return assignments;
    return assignments.filter(
      (a) => a.area.toLowerCase() === selectedTeam.toLowerCase()
    );
  }, [assignments, selectedTeam]);

  const cellMap = useMemo(
    () => assignmentsByCell(filteredAssignments),
    [filteredAssignments]
  );
  const clashes = useMemo(
    () => detectClashes(filteredAssignments),
    [filteredAssignments]
  );

  const clashKey = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const c of clashes)
      m.set(`${c.date}||${c.person.toLowerCase()}`, c.is_override);
    return m;
  }, [clashes]);

  const columns = useMemo(() => {
    const seen = new Map<string, { area: string; label: string }>();
    for (const a of filteredAssignments) {
      if (!seen.has(a.label)) seen.set(a.label, { area: a.area, label: a.label });
    }
    return Array.from(seen.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [filteredAssignments]);

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

  // Workload and Blackout clash calculations
  const volunteerStatsMap = useMemo(() => {
    const map = new Map<string, VolunteerWorkloadStats>();
    const visibleDatesSet = new Set(shownDates);
    const volDateCounts = new Map<string, Map<string, number>>();

    for (const a of filteredAssignments) {
      if (!visibleDatesSet.has(a.date)) continue;
      const key = a.person_name.toLowerCase();

      if (!map.has(key)) {
        map.set(key, {
          total: 0,
          clashDates: new Set(),
          blackoutClashDates: new Set(),
        });
      }
      const stat = map.get(key)!;
      stat.total += 1;

      // Unavailability Blackout check
      const personBlackouts = blackoutsMap[key];
      if (personBlackouts && personBlackouts.has(a.date)) {
        stat.blackoutClashDates.add(a.date);
      }

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
  }, [filteredAssignments, shownDates, blackoutsMap]);

  const doubleBookedVolunteersCount = useMemo(() => {
    let count = 0;
    for (const stat of volunteerStatsMap.values()) {
      if (stat.clashDates.size > 0 || stat.blackoutClashDates.size > 0) count++;
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

  const dateClashesMap = useMemo(() => {
    const map = new Map<
      string,
      Array<{
        person: string;
        roles: string[];
        areas: string[];
        isBlackoutClash?: boolean;
      }>
    >();

    for (const d of dates) {
      const dayAssignments = filteredAssignments.filter((a) => a.date === d);
      const personMap = new Map<string, Assignment[]>();

      for (const a of dayAssignments) {
        const key = a.person_name;
        if (!personMap.has(key)) personMap.set(key, []);
        personMap.get(key)!.push(a);
      }

      const dayClashes: Array<{
        person: string;
        roles: string[];
        areas: string[];
        isBlackoutClash?: boolean;
      }> = [];

      for (const [person, items] of personMap.entries()) {
        const key = person.toLowerCase();
        const hasDoubleBook = items.length > 1;
        const isBlackout = blackoutsMap[key]?.has(d);

        if (hasDoubleBook || isBlackout) {
          dayClashes.push({
            person,
            roles: items.map((i) => i.label),
            areas: Array.from(new Set(items.map((i) => i.area))),
            isBlackoutClash: isBlackout,
          });
        }
      }

      if (dayClashes.length > 0) {
        map.set(d, dayClashes);
      }
    }

    return map;
  }, [filteredAssignments, dates, blackoutsMap]);

  return (
    <div className="p-6 space-y-6">
      {/* Header Controls */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Live Roster</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {shownDates.length} Sundays · {filteredAssignments.length} assignments ·{" "}
            <span className="text-red-500 font-medium">
              {doubleBookedVolunteersCount} clashes / blackout conflicts
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={selectedTeam}
            onValueChange={(val) => updateSearchParams({ team: val })}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {availableTeams.map((team) => (
                <SelectItem key={team} value={team}>
                  {team}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filterMonth}
            onValueChange={(val) => updateSearchParams({ month: val })}
          >
            <SelectTrigger className="w-[150px]">
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

          <Button
            variant={isShareView ? "default" : "outline"}
            size="sm"
            onClick={() =>
              updateSearchParams({ view: isShareView ? "edit" : "share" })
            }
          >
            <Eye className="h-4 w-4 mr-1.5" />
            {isShareView ? "Interactive View" : "Share View"}
          </Button>
        </div>
      </div>

      {/* Roster Grid Table */}
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
                <th className="border-b border-l bg-muted/90 p-2 text-left font-semibold text-xs text-foreground min-w-[220px]">
                  Clashes & Blackouts
                </th>
              </tr>
            </thead>
            <tbody>
              {shownDates.map((d) => {
                const dayClashesList = dateClashesMap.get(d) || [];
                return (
                  <tr key={d} className="hover:bg-muted/20">
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
                              const key = a.person_name.toLowerCase();
                              const stats = volunteerStatsMap.get(key) || {
                                total: 0,
                                clashDates: new Set(),
                                blackoutClashDates: new Set(),
                              };
                              const paused = pausedNames.has(key);
                              const isClash = clashKey.has(`${a.date}||${key}`);
                              const isBlackoutOnDate =
                                blackoutsMap[key]?.has(a.date) ?? false;
                              const currentStatus =
                                statusMap[a.id] || "pending";

                              return (
                                <StatusCellBadge
                                  key={a.id}
                                  assignment={a}
                                  status={currentStatus}
                                  paused={paused}
                                  isClash={isClash}
                                  totalWorkload={stats.total}
                                  isBlackoutOnDate={isBlackoutOnDate}
                                  isShareView={isShareView}
                                  onStatusChange={(s) =>
                                    setAssignmentStatus(a.id, s)
                                  }
                                  onSelectSwap={() => setSwapTarget(a)}
                                  onSelectClash={() => {
                                    const items = filteredAssignments.filter(
                                      (x) =>
                                        x.date === a.date &&
                                        x.person_name.toLowerCase() === key
                                    );
                                    setClashDetail({
                                      date: a.date,
                                      person: a.person_name,
                                      items,
                                      isBlackout: isBlackoutOnDate,
                                    });
                                  }}
                                  onManageBlackouts={() => {
                                    setSelectedVolunteerForBlackouts({
                                      id: a.id,
                                      name: a.person_name,
                                    });
                                  }}
                                />
                              );
                            })}
                          </div>
                        </td>
                      );
                    })}

                    {/* Clashes Column */}
                    <td className="border-b border-l bg-muted/10 p-2 align-top">
                      {dayClashesList.length === 0 ? (
                        <div className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Clear
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {dayClashesList.map((c, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                const items = filteredAssignments.filter(
                                  (x) =>
                                    x.date === d &&
                                    x.person_name.toLowerCase() ===
                                      c.person.toLowerCase()
                                );
                                setClashDetail({
                                  date: d,
                                  person: c.person,
                                  items,
                                  isBlackout: c.isBlackoutClash,
                                });
                              }}
                              className={cn(
                                "text-left rounded-md border p-2 text-xs transition-colors cursor-pointer",
                                c.isBlackoutClash
                                  ? "border-purple-500/40 bg-purple-500/15 text-purple-800"
                                  : "border-red-500/40 bg-red-500/15 text-red-800"
                              )}
                            >
                              <div className="flex items-center gap-1.5 font-semibold">
                                {c.isBlackoutClash ? (
                                  <CalendarX className="h-3.5 w-3.5 text-purple-600" />
                                ) : (
                                  <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                                )}
                                <span>{c.person}</span>
                              </div>
                              <div className="mt-1 text-[11px] opacity-90">
                                {c.isBlackoutClash
                                  ? "Blackout Date Conflict"
                                  : `Double-booked in ${c.roles.join(", ")}`}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Blackout Date Management Modal */}
      <BlackoutManagementDialog
        volunteer={selectedVolunteerForBlackouts}
        blackouts={
          selectedVolunteerForBlackouts
            ? Array.from(
                blackoutsMap[
                  selectedVolunteerForBlackouts.name.toLowerCase()
                ] || []
              )
            : []
        }
        onToggleDate={(dateStr) => {
          if (selectedVolunteerForBlackouts) {
            toggleBlackoutDate(
              selectedVolunteerForBlackouts.name,
              dateStr
            );
          }
        }}
        onClose={() => setSelectedVolunteerForBlackouts(null)}
      />
    </div>
  );
}

function StatusCellBadge({
  assignment,
  status,
  paused,
  isClash,
  totalWorkload,
  isBlackoutOnDate,
  isShareView,
  onStatusChange,
  onSelectSwap,
  onSelectClash,
  onManageBlackouts,
}: {
  assignment: Assignment;
  status: AssignmentStatus;
  paused: boolean;
  isClash: boolean;
  totalWorkload: number;
  isBlackoutOnDate: boolean;
  isShareView?: boolean;
  onStatusChange: (status: AssignmentStatus) => void;
  onSelectSwap: () => void;
  onSelectClash: () => void;
  onManageBlackouts: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center justify-between rounded-md border px-2 py-1 text-xs transition-colors shadow-xs",
        isBlackoutOnDate
          ? "bg-purple-500/20 border-purple-500/40 text-purple-900 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(168,85,247,0.1)_5px,rgba(168,85,247,0.1)_10px)]"
          : isClash
          ? "bg-red-500/20 border-red-500/40 text-red-900"
          : "bg-gray-100 border-gray-200"
      )}
    >
      <button
        type="button"
        onClick={() => (isBlackoutOnDate || isClash ? onSelectClash() : onSelectSwap())}
        className="flex-1 text-left font-medium truncate flex items-center gap-1.5 cursor-pointer"
      >
        {isBlackoutOnDate ? (
          <CalendarX className="h-3.5 w-3.5 text-purple-600 shrink-0" />
        ) : isClash ? (
          <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
        ) : null}
        <span className="truncate">{assignment.person_name}</span>
      </button>

      {!isShareView && (
        <button
          type="button"
          onClick={onManageBlackouts}
          className="p-1 rounded hover:bg-black/10 text-purple-700 transition-opacity"
          title="Block out dates for this person"
        >
          <CalendarIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function BlackoutManagementDialog({
  volunteer,
  blackouts,
  onToggleDate,
  onClose,
}: {
  volunteer: { id: string; name: string } | null;
  blackouts: string[];
  onToggleDate: (dateStr: string) => void;
  onClose: () => void;
}) {
  const [newDate, setNewDate] = useState("");

  return (
    <Dialog open={!!volunteer} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        {volunteer && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarX className="h-5 w-5 text-purple-600" />
                Block Out Dates — {volunteer.name}
              </DialogTitle>
              <DialogDescription>
                Select dates when this volunteer is unavailable to serve.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="flex-1 text-sm"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (newDate) {
                      onToggleDate(newDate);
                      setNewDate("");
                    }
                  }}
                  disabled={!newDate}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Blackout
                </Button>
              </div>

              <div className="space-y-2 max-h-[200px] overflow-auto border rounded-lg p-2 bg-muted/20">
                <div className="text-xs font-semibold text-muted-foreground mb-1">
                  Unavailable Dates ({blackouts.length}):
                </div>

                {blackouts.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-4 text-center">
                    No unavailable dates recorded.
                  </div>
                ) : (
                  blackouts.sort().map((dateStr) => (
                    <div
                      key={dateStr}
                      className="flex items-center justify-between rounded-md border bg-card px-3 py-1.5 text-xs"
                    >
                      <span className="font-medium">
                        {format(parseISO(`${dateStr}T12:00:00`), "EEEE, d MMMM yyyy")}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                        onClick={() => onToggleDate(dateStr)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                Done
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
