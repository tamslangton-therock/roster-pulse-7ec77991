import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
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
  HeartHandshake,
} from "lucide-react";
import { useRoster, findVolunteer, type AssignmentStatus } from "@/lib/store";
import { ROSTER_SLOTS } from "@/lib/roster-grid";
import { resolveSubTeamColor } from "@/lib/person-colors";
import {
  assignmentsByCell,
  detectClashes,
  buildAllowedSet,
  groupAllowed,
  rankSwapCandidates,
} from "@/lib/roster-engine";
import {
  buildPartnerIndex,
  partnerGapsByDate,
  partnersStillRostered,
  suggestSlotsForPartner,
} from "@/lib/partners";
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
          "Interactive Sunday roster grid with team filtering, blackout date management, shareable view, and smart swaps.",
      },
    ],
  }),
  component: LiveRosterPage,
});

export type { AssignmentStatus } from "@/lib/store";

interface VolunteerWorkloadStats {
  total: number;
  clashDates: Set<string>;
  blackoutClashDates: Set<string>;
}

function LiveRosterPage() {
  const navigate = useNavigate({ from: Route.id });
  const search = Route.useSearch();

  const { volunteers, assignments, dates } = useRoster();
  const addRosterDate = useRoster((s) => s.addRosterDate);
  const assignSlot = useRoster((s) => s.assignSlot);
  const clearSlot = useRoster((s) => s.clearSlot);
  const [addDateOpen, setAddDateOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [slotTarget, setSlotTarget] = useState<{ date: string; label: string } | null>(null);
  const knownNames = useMemo(() => {
    const set = new Set<string>();
    for (const v of volunteers) if (v.full_name) set.add(v.full_name);
    for (const a of assignments) if (a.person_name) set.add(a.person_name);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [volunteers, assignments]);

  // URL State
  const selectedTeam = search.team || "all";
  const filterMonth = search.month || "all";
  const isShareView = search.view === "share";

  // Local UI State
  const [showClashesOnly, setShowClashesOnly] = useState(false);
  const [showPartnerSplitsOnly, setShowPartnerSplitsOnly] = useState(false);
  const [hidePastWeeks, setHidePastWeeks] = useState(true);
  const [swapTarget, setSwapTarget] = useState<Assignment | null>(null);
  const [partnerTarget, setPartnerTarget] = useState<{
    date: string;
    person: string;
    missing: string[];
  } | null>(null);
  const [clashDetail, setClashDetail] = useState<{
    date: string;
    person: string;
    items: Assignment[];
    isBlackout?: boolean;
  } | null>(null);

  // Blackout Dates Management Dialog state
  const [selectedVolunteerForBlackouts, setSelectedVolunteerForBlackouts] =
    useState<{ id: string; name: string } | null>(null);

  // Blockouts live in the Google Sheet ("Blockouts" tab) — editable from either side.
  const blockouts = useRoster((s) => s.blockouts);
  const toggleBlockout = useRoster((s) => s.toggleBlockout);

  // volunteer_name (lowercase) -> Set<"YYYY-MM-DD">
  const blackoutsMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const b of blockouts) {
      const key = b.person_name.trim().toLowerCase();
      if (!key || !b.date) continue;
      (map[key] ??= new Set<string>()).add(b.date);
    }
    return map;
  }, [blockouts]);

  const toggleBlackoutDate = (volunteerName: string, dateStr: string) => {
    const has = blackoutsMap[volunteerName.toLowerCase()]?.has(dateStr) ?? false;
    toggleBlockout(volunteerName, dateStr);
    if (has) toast.info(`Removed blackout date ${dateStr} for ${volunteerName}`);
    else toast.success(`Marked ${dateStr} as unavailable for ${volunteerName}`);
  };


  // Slot statuses persist in the Google Sheet ("Statuses" tab).
  const statusMap = useRoster((s) => s.statuses);
  const persistStatus = useRoster((s) => s.setAssignmentStatus);

  const updateSearchParams = (
    updates: Partial<z.infer<typeof rosterSearchSchema>>
  ) => {
    navigate({
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        ...updates,
      }),
      replace: true,
    });
  };

  const setAssignmentStatus = (
    date: string,
    label: string,
    status: AssignmentStatus
  ) => {
    persistStatus(date, label, status);
    const labels: Record<AssignmentStatus, string> = {
      pending: "Pending",
      reminder_sent: "Reminder Sent",
      declined: "Declined",
      confirmed: "Confirmed",
    };
    toast.success(`Set status to ${labels[status]}`);
  };

  // List of distinct teams/areas
  const availableTeams = useMemo(() => {
    const teams = new Set<string>();
    for (const a of assignments) {
      if (a.area) teams.add(a.area);
    }
    return Array.from(teams).sort();
  }, [assignments]);

  // Filter assignments by team first
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

  // Sub-team colour lookup: slot label + person → their sub-team pastel.
  const subTeams = useRoster((s) => s.subTeams);
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

  const allowedClashes = useRoster((s) => s.allowedClashes);
  const allowedSet = useMemo(
    () => buildAllowedSet(allowedClashes),
    [allowedClashes]
  );
  const clashes = useMemo(
    () => detectClashes(filteredAssignments, allowedSet),
    [filteredAssignments, allowedSet]
  );

  const clashKey = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const c of clashes)
      m.set(`${c.date}||${c.person.toLowerCase()}`, c.is_override);
    return m;
  }, [clashes]);

  // Fixed column set from the Live_Roster grid schema, so empty slots stay visible
  // and can be filled. When a team filter is active, narrow to that team's areas.
  const columns = useMemo(() => {
    const all = ROSTER_SLOTS.map((s) => ({ area: s.area, label: s.label }));
    if (selectedTeam === "all") return all;
    const areas = new Set(filteredAssignments.map((a) => a.area));
    return all.filter((c) => areas.has(c.area));
  }, [filteredAssignments, selectedTeam]);

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

  // Render the grid in chunks — the full year of Sundays × ~90 slots is far too
  // much DOM to mount at once and makes the first paint feel frozen.
  const ROW_CHUNK = 10;
  const [visibleRows, setVisibleRows] = useState(ROW_CHUNK);
  useEffect(() => {
    setVisibleRows(ROW_CHUNK);
  }, [filterMonth, hidePastWeeks, selectedTeam, showClashesOnly, showPartnerSplitsOnly]);
  const renderedDates = useMemo(
    () => shownDates.slice(0, visibleRows),
    [shownDates, visibleRows],
  );


  // Workload stats calculation + Blackout Clash Detection
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

      // Check for Blackout clash
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

      // Only a real clash when the pairing isn't an allowed exception.
      if (currentCount > 1 && clashKey.has(`${a.date}||${key}`)) {
        stat.clashDates.add(a.date);
      }
    }

    return map;
  }, [filteredAssignments, shownDates, blackoutsMap, clashKey]);

  // Double booked count & Blackout clashes count
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

  // ---- Family / partner alignment -------------------------------------
  // Linked partners should always serve on the same Sunday. Gaps are derived
  // from the FULL assignment list (not the team filter) so a partner serving
  // in another area still counts as aligned.
  const partnerIndex = useMemo(
    () => buildPartnerIndex(volunteers),
    [volunteers]
  );
  const partnerGaps = useMemo(
    () => partnerGapsByDate(assignments, partnerIndex),
    [assignments, partnerIndex]
  );

  /** Dates (within the visible rows) that have at least one split couple. */
  const partnerSplitDates = useMemo(() => {
    const set = new Set<string>();
    for (const a of filteredAssignments) {
      if (partnerGaps.has(`${a.date}||${a.person_name.toLowerCase()}`))
        set.add(a.date);
    }
    return set;
  }, [filteredAssignments, partnerGaps]);

  const partnerSplitCount = useMemo(() => {
    const visible = new Set(shownDates);
    let n = 0;
    const seen = new Set<string>();
    for (const a of filteredAssignments) {
      if (!visible.has(a.date)) continue;
      const key = `${a.date}||${a.person_name.toLowerCase()}`;
      if (seen.has(key)) continue;
      if (partnerGaps.has(key)) {
        seen.add(key);
        n++;
      }
    }
    return n;
  }, [filteredAssignments, shownDates, partnerGaps]);

  // Group clashes by date for Clashes column (including blackout clashes)
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
        const hasDoubleBook = items.length > 1 && !groupAllowed(items, allowedSet);
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
  }, [filteredAssignments, dates, blackoutsMap, allowedSet]);

  const copyShareableLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success("Shareable link copied to clipboard!");
  };

  return (
    <div className="p-6 space-y-6">
      {/* CSS Print Stylesheet */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .no-print, header, nav, sidebar, button, .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          .print\\:p-0 {
            padding: 0 !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:border-none {
            border: none !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            border: 1px solid #ccc !important;
            padding: 6px !important;
            page-break-inside: avoid;
          }
          thead {
            display: table-header-group !important;
          }
          tr {
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* Top Header Section */}
      <div className="flex flex-wrap items-end justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Live Roster</h1>
            {isShareView && (
              <span className="px-2 py-0.5 text-xs font-semibold bg-primary/10 text-primary rounded-full border border-primary/20">
                Shareable View
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {shownDates.length} Sundays · {filteredAssignments.length} assignments
            {selectedTeam !== "all" && ` (${selectedTeam})`} ·{" "}
            <span className="text-red-500 font-medium">
              {clashes.length +
                Array.from(volunteerStatsMap.values()).reduce(
                  (acc, curr) => acc + curr.blackoutClashDates.size,
                  0
                )}{" "}
              clashes/blackouts
            </span>
          </p>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Team Filter */}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
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
          </div>

          {/* Month Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
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
          </div>

          {/* Mode Toggle Button */}
          <Button
            variant={isShareView ? "default" : "outline"}
            size="sm"
            onClick={() =>
              updateSearchParams({ view: isShareView ? "edit" : "share" })
            }
          >
            <Eye className="h-4 w-4 mr-1.5" />
            {isShareView ? "Interactive Mode" : "Share View Mode"}
          </Button>

          {/* Share Link Button */}
          <Button variant="outline" size="sm" onClick={copyShareableLink}>
            <Share2 className="h-4 w-4 mr-1.5" />
            Share Link
          </Button>

          {/* Add Sunday */}
          {!isShareView && (
            <Button variant="outline" size="sm" onClick={() => setAddDateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Date
            </Button>
          )}

          {/* Team print / PDF */}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate({
                to: "/print",
                search: {
                  area: selectedTeam !== "all" ? selectedTeam : "",
                  months: filterMonth !== "all" ? filterMonth : "",
                },
              })
            }
          >
            <Printer className="h-4 w-4 mr-1.5" />
            Print / PDF
          </Button>
        </div>
      </div>

      {/* Filter Checkboxes Bar (Interactive Mode Only) */}
      {!isShareView && (
        <div className="flex flex-wrap items-center justify-end gap-4 no-print text-sm">
          <label className="flex items-center gap-2 cursor-pointer select-none">
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
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              checked={showClashesOnly}
              onCheckedChange={(v) => setShowClashesOnly(!!v)}
            />
            Clashes & Blackouts only
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              checked={showPartnerSplitsOnly}
              onCheckedChange={(v) => setShowPartnerSplitsOnly(!!v)}
            />
            <span className="flex items-center gap-1">
              <HeartHandshake className="h-3.5 w-3.5 text-pink-600 dark:text-pink-400" />
              Partners split only
              {partnerSplitCount > 0 && (
                <span className="ml-1 rounded-full bg-pink-500/15 px-1.5 py-0.5 text-[10px] font-bold text-pink-700 dark:text-pink-300">
                  {partnerSplitCount}
                </span>
              )}
            </span>
          </label>
        </div>
      )}

      {/* Printable Header Banner */}
      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold">Roster Pulse — Service Schedule</h1>
        <p className="text-sm text-gray-600">
          Team: {selectedTeam === "all" ? "All Departments" : selectedTeam} | Range:{" "}
          {filterMonth === "all" ? "Full Roster" : filterMonth}
        </p>
      </div>

      {/* Roster Capacity & Health Summary Banner */}
      <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-wrap items-center justify-between gap-4 print:hidden">
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
                  } clashes or blackout date conflicts.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1 rounded-full border bg-muted/50 font-medium">
            Clashed/Blackout Volunteers:{" "}
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
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm print:border-none print:shadow-none print:p-0">
        <div className="overflow-auto max-h-[calc(100vh-280px)] print:max-h-none">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10 print:static print:bg-transparent">
              <tr>
                <th className="sticky left-0 z-20 bg-muted border-b border-r p-3 text-left font-medium w-[140px] print:static print:bg-transparent">
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
                {/* Clashes Header */}
                <th className="border-b border-l bg-muted/90 p-2 text-left font-semibold text-xs text-foreground min-w-[220px] whitespace-nowrap print:bg-transparent">
                  Clashes & Blackouts
                </th>
              </tr>
            </thead>
            <tbody>
              {shownDates.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + 2}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No Sundays match the current filters.
                  </td>
                </tr>
              ) : (
                renderedDates.map((d) => {
                  const dayClashesList = dateClashesMap.get(d) || [];
                  const rowHasClash = dayClashesList.length > 0;
                  if (showClashesOnly && !rowHasClash) return null;
                  if (showPartnerSplitsOnly && !partnerSplitDates.has(d))
                    return null;

                  return (
                    <tr key={d} className="hover:bg-muted/20">
                      <td className="sticky left-0 z-10 bg-card border-b border-r p-3 font-medium whitespace-nowrap print:static print:bg-transparent">
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
                                  blackoutClashDates: new Set(),
                                };
                                const paused = pausedNames.has(key);
                                const isClash = clashKey.has(`${a.date}||${key}`);
                                const overridden = clashKey.get(`${a.date}||${key}`);
                                const isDoubleBookedOnDate = stats.clashDates.has(a.date);
                                const isBlackoutOnDate =
                                  blackoutsMap[key]?.has(a.date) ?? false;
                                const currentStatus: AssignmentStatus =
                                  statusMap[`${a.date}::${a.label}`] ||
                                  (a.status as AssignmentStatus) ||
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
                                    isBlackoutOnDate={isBlackoutOnDate}
                                    isShareView={isShareView}
                                    subTeam={subTeamMap.get(
                                      `${a.label}||${a.person_name.trim().toLowerCase()}`
                                    )}
                                    onStatusChange={(s) =>
                                      setAssignmentStatus(a.date, a.label, s)
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
                                      const vol = volunteers.find(
                                        (v) =>
                                          v.full_name.toLowerCase() === key
                                      );
                                      setSelectedVolunteerForBlackouts({
                                        id: vol?.id || a.id,
                                        name: a.person_name,
                                      });
                                    }}
                                  />
                                );
                              })}
                              {list.length === 0 && !isShareView && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSlotTarget({ date: d, label: c.label })
                                  }
                                  className="inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                >
                                  <Plus className="h-3 w-3" /> Add
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}

                      {/* Rightmost Clashes Cell */}
                      <td className="border-b border-l bg-muted/10 p-2 align-top print:bg-transparent">
                        {dayClashesList.length === 0 ? (
                          <div className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            No Clash
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {dayClashesList.map((c, i) => (
                              <button
                                key={i}
                                type="button"
                                disabled={isShareView}
                                onClick={() => {
                                  if (isShareView) return;
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
                                  "text-left rounded-md border p-2 text-xs transition-colors",
                                  c.isBlackoutClash
                                    ? "border-purple-500/40 bg-purple-500/15"
                                    : "border-red-500/40 bg-red-500/15",
                                  !isShareView && "hover:opacity-80 cursor-pointer"
                                )}
                              >
                                <div className="flex items-center gap-1.5 font-semibold">
                                  {c.isBlackoutClash ? (
                                    <CalendarX className="h-3.5 w-3.5 shrink-0 text-purple-600 dark:text-purple-400" />
                                  ) : (
                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" />
                                  )}
                                  <span
                                    className={
                                      c.isBlackoutClash
                                        ? "text-purple-700 dark:text-purple-300"
                                        : "text-red-700 dark:text-red-300"
                                    }
                                  >
                                    {c.person}
                                  </span>
                                </div>
                                <div className="mt-1 text-[11px] opacity-90 space-y-0.5">
                                  {c.isBlackoutClash && (
                                    <div className="font-semibold text-purple-700 dark:text-purple-300">
                                      ⚠ Blackout Date Conflict
                                    </div>
                                  )}
                                  <div>
                                    <span className="font-medium">Roles:</span>{" "}
                                    {c.roles.join(", ")}
                                  </div>
                                  <div>
                                    <span className="font-medium">Areas:</span>{" "}
                                    {c.areas.join(", ")}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {visibleRows < shownDates.length && (
          <div className="flex items-center justify-center gap-3 border-t bg-muted/30 p-3 text-xs print:hidden">
            <span className="text-muted-foreground">
              Showing {renderedDates.length} of {shownDates.length} Sundays
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setVisibleRows((n) => n + ROW_CHUNK)}
            >
              Show more
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setVisibleRows(shownDates.length)}
            >
              Show all
            </Button>
          </div>
        )}
      </div>


      {!isShareView && (
        <>
          <SwapDialog target={swapTarget} onClose={() => setSwapTarget(null)} />
          <ClashDialog detail={clashDetail} onClose={() => setClashDetail(null)} />
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
          <AddDateDialog
            open={addDateOpen}
            value={newDate}
            onValueChange={setNewDate}
            onClose={() => setAddDateOpen(false)}
            onConfirm={() => {
              if (!newDate) return;
              addRosterDate(newDate);
              toast.success(`Added ${newDate} to the roster`);
              setNewDate("");
              setAddDateOpen(false);
            }}
          />
          <FillSlotDialog
            target={slotTarget}
            names={knownNames}
            onClose={() => setSlotTarget(null)}
            onConfirm={(name: string) => {
              if (!slotTarget) return;
              if (name.trim()) {
                assignSlot(slotTarget.date, slotTarget.label, name.trim());
                toast.success(`${name.trim()} added to ${slotTarget.label}`);
              } else {
                clearSlot(slotTarget.date, slotTarget.label);
              }
              setSlotTarget(null);
            }}
          />
        </>
      )}
    </div>
  );
}

/**
 * High-Visibility Status Badge with Workload, Double-Booking, & Blackout Highlights
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
  isBlackoutOnDate,
  isShareView,
  subTeam,
  onStatusChange,
  onSelectSwap,
  onSelectClash,
  onManageBlackouts,
}: {
  assignment: Assignment;
  status: AssignmentStatus;
  paused: boolean;
  isClash: boolean;
  overridden?: boolean;
  totalWorkload: number;
  clashDatesCount: number;
  isDoubleBookedOnDate: boolean;
  isBlackoutOnDate: boolean;
  isShareView?: boolean;
  subTeam?: { name: string; color: { bg: string; border: string; text: string } };
  onStatusChange: (status: AssignmentStatus) => void;
  onSelectSwap: () => void;
  onSelectClash: () => void;
  onManageBlackouts: () => void;
}) {
  const getBadgeStyle = () => {
    if (isBlackoutOnDate) {
      return "bg-purple-500/20 text-purple-800 dark:text-purple-300 border-purple-500/40 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(168,85,247,0.08)_5px,rgba(168,85,247,0.08)_10px)]";
    }
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
    if (isBlackoutOnDate)
      return <CalendarX className="h-3 w-3 text-purple-600 shrink-0" />;
    if (paused) return <Pause className="h-3 w-3 text-amber-600 shrink-0" />;
    if (isClash) return <AlertTriangle className="h-3 w-3 text-red-600 shrink-0" />;
    switch (status) {
      case "reminder_sent":
        return <Clock className="h-3 w-3 text-amber-600 shrink-0" />;
      case "declined":
        return <XCircle className="h-3 w-3 text-red-600 shrink-0" />;
      case "confirmed":
        return <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />;
      case "pending":
      default:
        return <HelpCircle className="h-3 w-3 text-gray-400 shrink-0" />;
    }
  };

  return (
    <div
      className={cn(
        "group flex items-center justify-between rounded-md border px-2 py-1 text-xs transition-colors shadow-xs",
        getBadgeStyle(),
        isDoubleBookedOnDate && "ring-2 ring-red-500/60 bg-red-500/15"
      )}
      style={
        subTeam && !paused && !isClash && !isBlackoutOnDate
          ? { borderLeft: `4px solid ${subTeam.color.border}` }
          : undefined
      }
    >
      <button
        type="button"
        disabled={isShareView}
        onClick={() => {
          if (isShareView) return;
          if ((isClash && !overridden) || isBlackoutOnDate) {
            onSelectClash();
          } else {
            onSelectSwap();
          }
        }}
        className={cn(
          "flex-1 text-left font-medium truncate flex items-center gap-1.5 focus:outline-hidden",
          !isShareView && "cursor-pointer"
        )}
      >
        {getIcon()}
        {subTeam && (
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: subTeam.color.border }}
            title={`Sub-team: ${subTeam.name}`}
          />
        )}
        <span className="truncate">{assignment.person_name}</span>

        {clashDatesCount > 0 && (
          <span
            className="flex items-center gap-0.5 px-1 py-0.2 text-[10px] rounded-full bg-red-600 text-white font-bold shrink-0 print:hidden"
            title={`Double-booked on ${clashDatesCount} date${
              clashDatesCount > 1 ? "s" : ""
            }`}
          >
            <AlertTriangle className="h-2.5 w-2.5" />
            {clashDatesCount}
          </span>
        )}

        <span
          className="flex items-center gap-0.5 px-1.5 py-0.2 text-[10px] rounded-md bg-black/10 dark:bg-white/15 font-mono text-muted-foreground dark:text-gray-200 shrink-0 print:hidden"
          title={`Assigned ${totalWorkload} shift(s) across visible range`}
        >
          <Layers className="h-2.5 w-2.5 opacity-70" />
          {totalWorkload}
        </span>
      </button>

      {/* Action buttons on badge */}
      {!isShareView && (
        <div className="flex items-center gap-0.5 print:hidden">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onManageBlackouts();
            }}
            className="p-0.5 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 transition-opacity cursor-pointer opacity-50 group-hover:opacity-100"
            title="Manage Blackout / Unavailable Dates"
          >
            <CalendarX className="h-3 w-3 text-purple-600 dark:text-purple-400" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="p-0.5 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 transition-opacity cursor-pointer"
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
              <DropdownMenuItem
                onClick={() => onStatusChange("reminder_sent")}
              >
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
      )}
    </div>
  );
}

/**
 * Dialog to view, add, or clear unavailable / blackout dates for a specific volunteer
 */
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
                Manage Blackouts — {volunteer.name}
              </DialogTitle>
              <DialogDescription>
                Add or remove dates when this volunteer is unavailable.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {/* Add Blackout Input */}
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
                  <Plus className="h-4 w-4 mr-1" /> Add Date
                </Button>
              </div>

              {/* Current Blackout Dates List */}
              <div className="space-y-2 max-h-[220px] overflow-auto border rounded-lg p-2 bg-muted/20">
                <div className="text-xs font-semibold text-muted-foreground mb-1">
                  Current Unavailable Dates ({blackouts.length}):
                </div>

                {blackouts.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-4 text-center">
                    No blackout dates set for {volunteer.name}.
                  </div>
                ) : (
                  blackouts
                    .sort()
                    .map((dateStr) => (
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
  detail: {
    date: string;
    person: string;
    items: Assignment[];
    isBlackout?: boolean;
  } | null;
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
                {detail.isBlackout ? (
                  <CalendarX className="h-5 w-5 text-purple-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                )}
                {detail.isBlackout ? "Blackout Clash — " : "Double-Booking Clash — "}
                {detail.person}
              </DialogTitle>
              <DialogDescription>
                {format(parseISO(`${detail.date}T12:00:00`), "EEEE d MMMM yyyy")} ·
                assigned to {live.length} role(s)
              </DialogDescription>
            </DialogHeader>

            {detail.isBlackout && (
              <div className="rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-800 dark:text-purple-300 p-3 text-xs font-medium">
                ⚠ {detail.person} has marked this date as unavailable / blacked out.
              </div>
            )}

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
              Allow as exception (approved assignment)
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

function AddDateDialog({
  open,
  value,
  onValueChange,
  onClose,
  onConfirm,
}: {
  open: boolean;
  value: string;
  onValueChange: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a roster date</DialogTitle>
          <DialogDescription>
            Adds a new row to the Live_Roster tab in your Google Sheet.
          </DialogDescription>
        </DialogHeader>
        <Input
          type="date"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={!value}>
            Add date
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FillSlotDialog({
  target,
  names,
  onClose,
  onConfirm,
}: {
  target: { date: string; label: string } | null;
  names: string[];
  onClose: () => void;
  onConfirm: (name: string) => void;
}) {
  const [name, setName] = useState("");
  useEffect(() => {
    setName("");
  }, [target?.date, target?.label]);
  if (!target) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{target.label}</DialogTitle>
          <DialogDescription>
            {format(parseISO(`${target.date}T12:00:00`), "EEEE d MMMM yyyy")}
          </DialogDescription>
        </DialogHeader>
        <Input
          list="roster-known-names"
          placeholder="Type or pick a name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onConfirm(name);
          }}
          autoFocus
        />
        <datalist id="roster-known-names">
          {names.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(name)} disabled={!name.trim()}>
            Assign
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
