import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { format, parseISO, isValid } from "date-fns";
import {
  Users,
  Search,
  Plus,
  Calendar,
  CalendarX,
  PauseCircle,
  PlayCircle,
  Trash2,
} from "lucide-react";
import { useRoster } from "@/lib/store";
import type { Volunteer } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/volunteers")({
  head: () => ({
    meta: [
      { title: "Volunteers — Roster Pulse" },
      {
        name: "description",
        content:
          "Manage volunteer directory, skills, availability, and block out unavailable dates.",
      },
    ],
  }),
  component: VolunteersPage,
});

function safeFormatDate(dateStr: string, formatPattern: string): string {
  if (!dateStr) return "";
  try {
    const parsed = parseISO(dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00`);
    if (isValid(parsed)) {
      return format(parsed, formatPattern);
    }
  } catch (e) {
    // Return raw date string if parsing fails
  }
  return dateStr;
}

export function VolunteersPage() {
  const store = useRoster();

  const volunteers = store?.volunteers || [];
  const assignments = store?.assignments || [];
  const updateVolunteer = store?.updateVolunteer || (() => {});

  const [localBlackouts, setLocalBlackouts] = useState<Record<string, string[]>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(null);
  const [activeTab, setActiveTab] = useState("shifts");
  const [newBlackoutDate, setNewBlackoutDate] = useState("");

  const getBlackoutDates = (volunteerName?: string): string[] => {
    if (!volunteerName) return [];
    const key = volunteerName.toLowerCase();

    const vol = (volunteers || []).find((v) => v?.full_name?.toLowerCase() === key);
    if (vol?.blackout_dates && Array.isArray(vol.blackout_dates)) {
      return vol.blackout_dates;
    }

    if (store?.blackoutsMap && store.blackoutsMap[key]) {
      return store.blackoutsMap[key] || [];
    }

    return localBlackouts[key] || [];
  };

  const toggleBlackout = (volunteerName: string, dateStr: string) => {
    if (!volunteerName || !dateStr) return;
    const key = volunteerName.toLowerCase();

    if (store?.toggleBlackoutDate) {
      store.toggleBlackoutDate(volunteerName, dateStr);
    } else {
      setLocalBlackouts((prev) => {
        const current = prev[key] || [];
        const updated = current.includes(dateStr)
          ? current.filter((d) => d !== dateStr)
          : [...current, dateStr].sort();
        return { ...prev, [key]: updated };
      });
    }
  };

  const filteredVolunteers = useMemo(() => {
    if (!Array.isArray(volunteers)) return [];
    
    return volunteers.filter((v) => {
      if (!v) return false;
      const q = searchQuery.toLowerCase();
      const nameMatch = v.full_name ? v.full_name.toLowerCase().includes(q) : false;
      const emailMatch = v.email ? v.email.toLowerCase().includes(q) : false;
      const phoneMatch = v.phone ? v.phone.toLowerCase().includes(q) : false;

      const areas = Array.isArray(v.serving_areas)
        ? v.serving_areas
        : Array.isArray((v as any)?.teams)
        ? (v as any).teams
        : [];

      const areaMatch = areas.some((area: string) =>
        area ? area.toLowerCase().includes(q) : false
      );

      return nameMatch || emailMatch || phoneMatch || areaMatch;
    });
  }, [volunteers, searchQuery]);

  const activeAssignments = useMemo(() => {
    if (!selectedVolunteer?.full_name || !Array.isArray(assignments)) return [];
    const target = selectedVolunteer.full_name.toLowerCase();
    return assignments.filter(
      (a) => a?.person_name && a.person_name.toLowerCase() === target
    );
  }, [assignments, selectedVolunteer]);

  const activeBlackouts = useMemo(() => {
    if (!selectedVolunteer?.full_name) return [];
    return getBlackoutDates(selectedVolunteer.full_name);
  }, [selectedVolunteer, localBlackouts, store?.blackoutsMap, volunteers]);

  const handleToggleBlackoutDate = (dateStr: string) => {
    if (!selectedVolunteer?.full_name) return;
    const exists = activeBlackouts.includes(dateStr);

    toggleBlackout(selectedVolunteer.full_name, dateStr);

    if (exists) {
      toast.info(`Removed ${dateStr} from blocked out dates.`);
    } else {
      toast.success(`Blocked out ${dateStr} for ${selectedVolunteer.full_name}.`);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Volunteer Directory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage volunteer profiles, serving areas, workload, and blackout dates.
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(filteredVolunteers || []).map((v) => {
          if (!v) return null;
          const vName = v.full_name || "Volunteer";
          
          const safeAssignments = Array.isArray(assignments) ? assignments : [];
          const vAssignments = safeAssignments.filter(
            (a) => a?.person_name?.toLowerCase() === vName.toLowerCase()
          );
          
          const vBlackouts = getBlackoutDates(vName) || [];

          const safeAreas: string[] = Array.isArray(v.serving_areas)
            ? v.serving_areas
            : Array.isArray((v as any)?.teams)
            ? (v as any).teams
            : [];

          return (
            <div
              key={v.id || vName}
              onClick={() => setSelectedVolunteer(v)}
              className={cn(
                "group relative rounded-xl border bg-card p-4 shadow-xs transition-all hover:border-primary/50 hover:shadow-md cursor-pointer",
                v.is_paused && "opacity-60 bg-muted/30"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-base group-hover:text-primary transition-colors">
                    {vName}
                  </h3>
                  <p className="text-xs text-muted-foreground">{v.email || v.phone || ""}</p>
                </div>
                {v.is_paused ? (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-700 bg-amber-500/10 text-[10px]">
                    <PauseCircle className="h-3 w-3 mr-1" /> Paused
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    Active
                  </Badge>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-1">
                {safeAreas.map((area) => (
                  <Badge key={area} variant="secondary" className="text-[10px] font-normal">
                    {area}
                  </Badge>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {vAssignments.length} shifts
                </span>
                {vBlackouts.length > 0 && (
                  <span className="flex items-center gap-1 text-purple-700 font-medium">
                    <CalendarX className="h-3.5 w-3.5" />
                    {vBlackouts.length} blocked date{vBlackouts.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Sheet
        open={!!selectedVolunteer}
        onOpenChange={(open) => !open && setSelectedVolunteer(null)}
      >
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedVolunteer && (
            <>
              <SheetHeader className="pb-4 border-b">
                <SheetTitle className="text-xl font-bold flex items-center justify-between">
                  <span>{selectedVolunteer.full_name}</span>
                </SheetTitle>
                <SheetDescription>{selectedVolunteer.email || selectedVolunteer.phone}</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">Roster Status</div>
                    <div className="text-xs text-muted-foreground">
                      {selectedVolunteer.is_paused
                        ? "Paused from automatic rostering"
                        : "Active for rostering"}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={selectedVolunteer.is_paused ? "default" : "outline"}
                    onClick={() => {
                      const updated = {
                        ...selectedVolunteer,
                        is_paused: !selectedVolunteer.is_paused,
                      };
                      updateVolunteer(updated);
                      setSelectedVolunteer(updated);
                      toast.success(`Updated status for ${selectedVolunteer.full_name}`);
                    }}
                  >
                    {selectedVolunteer.is_paused ? (
                      <>
                        <PlayCircle className="h-4 w-4 mr-1.5" /> Resume
                      </>
                    ) : (
                      <>
                        <PauseCircle className="h-4 w-4 mr-1.5" /> Pause
                      </>
                    )}
                  </Button>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="shifts" className="text-xs">
                      Shifts ({activeAssignments.length})
                    </TabsTrigger>
                    <TabsTrigger value="blackouts" className="text-xs">
                      Block Out Dates ({activeBlackouts.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="shifts" className="mt-4 space-y-3">
                    {(activeAssignments || []).length === 0 ? (
                      <div className="text-center py-6 text-sm text-muted-foreground border rounded-lg">
                        No upcoming rostered shifts.
                      </div>
                    ) : (
                      (activeAssignments || []).map((a) => {
                        const isBlackedOut = activeBlackouts.includes(a.date);
                        const formattedDate = safeFormatDate(a.date, "EEEE, d MMM yyyy");

                        return (
                          <div
                            key={a.id}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-lg border text-xs",
                              isBlackedOut
                                ? "bg-purple-500/10 border-purple-500/30 text-purple-900"
                                : "bg-card"
                            )}
                          >
                            <div className="space-y-1">
                              <div className="font-semibold flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                {formattedDate}
                              </div>
                              <div className="text-muted-foreground">
                                {a.area} — <span className="font-medium text-foreground">{a.label}</span>
                              </div>
                            </div>

                            {isBlackedOut && (
                              <Badge variant="outline" className="border-purple-500/40 text-purple-700 bg-purple-500/15">
                                <CalendarX className="h-3 w-3 mr-1" /> Blackout
                              </Badge>
                            )}
                          </div>
                        );
                      })
                    )}
                  </TabsContent>

                  <TabsContent value="blackouts" className="mt-4 space-y-4">
                    <div className="p-3 rounded-lg border bg-purple-500/5 space-y-3">
                      <Label className="text-xs font-semibold text-purple-900 flex items-center gap-1.5">
                        <CalendarX className="h-4 w-4 text-purple-600" />
                        Add Blocked Date
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Select dates {selectedVolunteer.full_name} cannot be rostered on.
                      </p>

                      <div className="flex items-center gap-2 pt-1">
                        <Input
                          type="date"
                          value={newBlackoutDate}
                          onChange={(e) => setNewBlackoutDate(e.target.value)}
                          className="h-8 text-xs bg-background"
                        />
                        <Button
                          size="sm"
                          className="h-8 text-xs shrink-0"
                          disabled={!newBlackoutDate}
                          onClick={() => {
                            if (newBlackoutDate) {
                              handleToggleBlackoutDate(newBlackoutDate);
                              setNewBlackoutDate("");
                            }
                          }}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> Block Date
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground">
                        Currently Blocked Out Dates:
                      </div>

                      {(activeBlackouts || []).length === 0 ? (
                        <div className="text-xs text-center py-6 text-muted-foreground border border-dashed rounded-lg">
                          No blackout dates set for {selectedVolunteer.full_name}.
                        </div>
                      ) : (
                        [...(activeBlackouts || [])].sort().map((dateStr) => {
                          const formattedLabel = safeFormatDate(dateStr, "EEEE, d MMMM yyyy");

                          return (
                            <div
                              key={dateStr}
                              className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs"
                            >
                              <span className="font-medium">{formattedLabel}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 text-xs"
                                onClick={() => handleToggleBlackoutDate(dateStr)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
