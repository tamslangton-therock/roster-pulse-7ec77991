import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { format, parseISO, isValid } from "date-fns";
import {
  Users,
  Search,
  Calendar,
  CalendarX,
  PauseCircle,
  PlayCircle,
  AlertTriangle,
  Plus,
  Trash2,
  AlertCircle,
  X,
} from "lucide-react";
import { useRoster } from "@/lib/store";
import type { Volunteer } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/volunteers")({
  head: () => ({
    meta: [
      { title: "Volunteers — Roster Pulse" },
      {
        name: "description",
        content: "Manage volunteer directory, teams, availability, and blackout dates.",
      },
    ],
  }),
  component: VolunteersPage,
});

function formatDateLabel(dateStr: string): string {
  try {
    const parsed = parseISO(dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00`);
    if (isValid(parsed)) {
      return format(parsed, "EEEE, d MMMM yyyy");
    }
  } catch {
    // Fallback
  }
  return dateStr;
}

export function VolunteersPage() {
  const store = useRoster();

  const volunteers = Array.isArray(store?.volunteers) ? store.volunteers : [];
  const assignments = Array.isArray(store?.assignments) ? store.assignments : [];
  const updateVolunteer = store?.updateVolunteer ?? (() => {});

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(null);
  const [newDate, setNewDate] = useState("");

  const getBlackoutDates = (volunteerName?: string): string[] => {
    if (!volunteerName) return [];
    if (typeof store?.getBlackoutDates === "function") {
      const dates = store.getBlackoutDates(volunteerName);
      if (Array.isArray(dates)) return dates;
    }
    const vol = volunteers.find(
      (v) => v?.full_name?.toLowerCase() === volunteerName.toLowerCase()
    );
    return Array.isArray(vol?.blackout_dates) ? vol.blackout_dates : [];
  };

  const toggleBlackoutDate = (volunteerName: string, dateStr: string) => {
    if (!volunteerName || !dateStr) return;
    if (typeof store?.toggleBlackoutDate === "function") {
      store.toggleBlackoutDate(volunteerName, dateStr);
    }
  };

  const filteredVolunteers = useMemo(() => {
    return volunteers.filter((v) => {
      if (!v) return false;
      const q = (searchQuery || "").toLowerCase();
      const nameMatch = v?.full_name ? v.full_name.toLowerCase().includes(q) : false;
      const emailMatch = v?.email ? v.email.toLowerCase().includes(q) : false;
      const phoneMatch = v?.phone ? v.phone.toLowerCase().includes(q) : false;

      const areas = Array.isArray(v?.serving_areas)
        ? v.serving_areas
        : Array.isArray((v as any)?.teams)
        ? (v as any).teams
        : [];

      const areaMatch = areas.some((area: string) =>
        typeof area === "string" ? area.toLowerCase().includes(q) : false
      );

      return nameMatch || emailMatch || phoneMatch || areaMatch;
    });
  }, [volunteers, searchQuery]);

  const activeBlackouts = selectedVolunteer
    ? getBlackoutDates(selectedVolunteer.full_name)
    : [];

  const activeConflicts = selectedVolunteer
    ? assignments.filter(
        (a) =>
          a?.person_name?.toLowerCase() === selectedVolunteer.full_name.toLowerCase() &&
          activeBlackouts.includes(a.date)
      )
    : [];

  const handleAddDate = () => {
    if (!selectedVolunteer || !newDate) return;
    if (activeBlackouts.includes(newDate)) {
      toast.info("This date is already blocked out.");
      return;
    }
    toggleBlackoutDate(selectedVolunteer.full_name, newDate);
    toast.success(`Blocked out ${newDate} for ${selectedVolunteer.full_name}.`);
    setNewDate("");
  };

  const handleRemoveDate = (dateStr: string) => {
    if (!selectedVolunteer) return;
    toggleBlackoutDate(selectedVolunteer.full_name, dateStr);
    toast.info(`Removed ${dateStr} from blackout dates.`);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Volunteer Directory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage volunteer profiles, teams, workload, and blackout unavailable dates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search volunteers or areas..."
              className="pl-9 h-9 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Volunteer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVolunteers.map((v) => {
          if (!v) return null;
          const vName = v.full_name || "Volunteer";

          const vAssignments = assignments.filter(
            (a) => a?.person_name?.toLowerCase() === vName.toLowerCase()
          );
          const vBlackouts = getBlackoutDates(vName);
          const hasClash = vAssignments.some((a) => vBlackouts.includes(a.date));

          const safeAreas = Array.isArray(v.serving_areas)
            ? v.serving_areas
            : Array.isArray((v as any)?.teams)
            ? (v as any).teams
            : [];

          return (
            <div
              key={v.id || vName}
              className={`rounded-xl border bg-card p-4 shadow-sm flex flex-col justify-between transition-all hover:border-primary/50 ${
                v.is_paused ? "opacity-60 bg-muted/30" : ""
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-base flex items-center gap-2">
                      {vName}
                      {hasClash && (
                        <AlertTriangle
                          className="h-4 w-4 text-red-600 animate-pulse"
                          title="Blackout Date Clash!"
                        />
                      )}
                    </h3>
                    <p className="text-xs text-muted-foreground">{v.email || v.phone || ""}</p>
                  </div>

                  <button
                    type="button"
                    className="px-2 py-1 text-[11px] font-medium border rounded hover:bg-accent transition-colors"
                    onClick={() => {
                      const updated = { ...v, is_paused: !v.is_paused };
                      updateVolunteer(updated);
                      toast.success(`Updated status for ${vName}`);
                    }}
                  >
                    {v.is_paused ? "Paused" : "Active"}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {safeAreas.map((area: string) => (
                    <Badge key={area} variant="secondary" className="text-[10px] font-normal">
                      {area}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* BOTTOM FOOTER WITH BLACKOUT BUTTON */}
              <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {vAssignments.length} shift{vAssignments.length === 1 ? "" : "s"}
                </span>

                <button
                  type="button"
                  onClick={() => setSelectedVolunteer(v)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md border flex items-center gap-1.5 transition-colors ${
                    hasClash
                      ? "border-red-600 bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-900/30"
                      : vBlackouts.length > 0
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100"
                      : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <CalendarX className="h-3.5 w-3.5 text-purple-600" />
                  {vBlackouts.length > 0 ? `${vBlackouts.length} Blocked` : "Set Blackout"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightweight Overlay Modal */}
      {selectedVolunteer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card border p-5 shadow-lg space-y-4 relative">
            <button
              type="button"
              onClick={() => setSelectedVolunteer(null)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 text-lg font-semibold">
              <CalendarX className="h-5 w-5 text-purple-600" />
              Manage Blackout Dates
            </div>
            <p className="text-xs text-muted-foreground">
              Block out dates when <strong>{selectedVolunteer.full_name}</strong> is unavailable.
            </p>

            {/* Conflict Banner */}
            {activeConflicts.length > 0 && (
              <div className="p-3 rounded-lg bg-red-900/15 border border-red-700/40 text-red-900 dark:text-red-200 flex items-start gap-2 text-xs">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold block">Active Blackout Clash Detected!</strong>
                  {selectedVolunteer.full_name} is rostered on {activeConflicts.length} blacked-out date(s).
                </div>
              </div>
            )}

            {/* Date Picker Input */}
            <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
              <label className="text-xs font-semibold block">Add Unavailable Date</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="h-9 px-3 rounded-md border text-xs bg-background flex-1"
                />
                <button
                  type="button"
                  onClick={handleAddDate}
                  className="h-9 px-3 text-xs font-medium bg-primary text-primary-foreground rounded-md flex items-center gap-1 hover:opacity-90"
                >
                  <Plus className="h-4 w-4" /> Block Date
                </button>
              </div>
            </div>

            {/* Blackout List */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">
                Currently Blocked Out ({activeBlackouts.length})
              </div>

              {activeBlackouts.length === 0 ? (
                <div className="text-xs text-center py-6 text-muted-foreground border border-dashed rounded-lg">
                  No blackout dates set for this volunteer.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {[...activeBlackouts].sort().map((dateStr) => {
                    const isConflicting = assignments.some(
                      (a) =>
                        a?.person_name?.toLowerCase() === selectedVolunteer.full_name.toLowerCase() &&
                        a.date === dateStr
                    );

                    return (
                      <div
                        key={dateStr}
                        className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${
                          isConflicting
                            ? "bg-red-950/20 border-red-700/50 text-red-900 dark:text-red-200"
                            : "bg-card"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatDateLabel(dateStr)}</span>
                          {isConflicting && (
                            <Badge variant="destructive" className="text-[10px] bg-red-700">
                              Clash
                            </Badge>
                          )}
                        </div>
                        <button
                          type="button"
                          className="text-red-500 hover:text-red-700 p-1"
                          onClick={() => handleRemoveDate(dateStr)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedVolunteer(null)}
                className="px-4 py-1.5 text-xs font-medium border rounded-md hover:bg-accent"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
