import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, parseISO, isAfter, startOfDay } from "date-fns";
import { Search, UserCheck, Calendar, ShieldAlert, Plus, CalendarX, Trash2 } from "lucide-react";

import { useRoster } from "@/lib/store";
import { computeFatigue, upcomingForPerson } from "@/lib/roster-engine";
import type { Volunteer } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const AREAS = [
  "Welcome", "Car Park", "Count", "Tea", "Hosting", "Hang Tight", "Host",
  "Barista", "Milk", "Shots", "Cashier", "Media", "Camera", "Sound",
  "Egg & Bacon", "Kids", "Teens", "Worship", "Preach", "MC", "Lift",
];

export const Route = createFileRoute("/volunteers")({
  head: () => ({
    meta: [
      { title: "Volunteer Directory — Roster Pulse" },
      {
        name: "description",
        content:
          "Searchable directory of volunteers with profiles, serving preferences, pause toggles, and upcoming assignments.",
      },
      { property: "og:title", content: "Volunteer Directory — Roster Pulse" },
      {
        property: "og:description",
        content:
          "Manage profiles, partners, serving areas, frequency preferences, and pause status.",
      },
    ],
  }),
  component: VolunteersPage,
});

function VolunteersPage() {
  const { volunteers, assignments, addVolunteer } = useRoster();
  const [q, setQ] = useState("");
  const [areaFilter, setAreaFilter] = useState("all");
  const [memberView, setMemberView] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("all");
  const [selected, setSelected] = useState<Volunteer | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const sortedVolunteers = useMemo(() => {
    return [...volunteers].sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [volunteers]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return volunteers.filter((v) => {
      if (memberView && selectedMemberId !== "all" && v.id !== selectedMemberId) {
        return false;
      }
      if (query && !v.full_name.toLowerCase().includes(query)) return false;
      if (
        areaFilter !== "all" &&
        !v.serving_areas.some((a) => a.toLowerCase() === areaFilter.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [volunteers, q, areaFilter, memberView, selectedMemberId]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Volunteers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} of {volunteers.length} people
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Member View Toggle */}
          <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-card">
            <UserCheck className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium">Member View</span>
            <Switch
              checked={memberView}
              onCheckedChange={(val) => {
                setMemberView(val);
                if (!val) setSelectedMemberId("all");
              }}
            />
          </div>

          {memberView && (
            <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Members</SelectItem>
                {sortedVolunteers.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="relative flex-1 sm:w-[200px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={areaFilter} onValueChange={setAreaFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Serving area" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All areas</SelectItem>
              {AREAS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={() => setShowAddDialog(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add New
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.map((v) => {
          const f = computeFatigue(v, assignments);
          const upcomingSlots = upcomingForPerson(v.full_name, assignments);
          return (
            <button
              key={v.id}
              onClick={() => setSelected(v)}
              className="text-left rounded-xl border bg-card p-4 hover:shadow-md hover:border-ring/40 transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{v.full_name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {v.serving_areas.slice(0, 3).join(" · ") || "—"}
                    </div>
                  </div>
                  <StatusBadge status={f.status} showEmoji />
                </div>

                {memberView && (
                  <div className="mt-3 p-2 rounded-lg bg-muted/60 text-xs space-y-1">
                    <div className="font-medium text-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-primary" />
                      Next Serving:
                    </div>
                    {upcomingSlots.length > 0 ? (
                      <div className="text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {format(parseISO(upcomingSlots[0].date), "d MMM")}:
                        </span>{" "}
                        {upcomingSlots[0].label}
                      </div>
                    ) : (
                      <div className="text-muted-foreground italic">No upcoming dates</div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 mt-3 text-[11px] text-muted-foreground pt-2 border-t border-border/40">
                <span>4w: {f.last4}</span>
                <span>8w: {f.last8}</span>
                {v.partners.length > 0 && (
                  <span className="truncate">💞 {v.partners[0]}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <VolunteerSheet volunteer={selected} onClose={() => setSelected(null)} />
      <AddVolunteerDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} onAdd={addVolunteer} />
    </div>
  );
}

function AddVolunteerDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (v: Omit<Volunteer, "id">) => void;
}) {
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    serving_areas: [] as string[],
    partners: [] as string[],
    max_serving_per_month: "2",
    frequency_preference: "2x/month",
    priority_area: "",
    notes: "",
  });

  const handleSubmit = () => {
    if (!formData.full_name.trim()) {
      toast.error("Please enter a volunteer name");
      return;
    }
    onAdd({
      full_name: formData.full_name,
      email: formData.email,
      phone: formData.phone,
      serving_areas: formData.serving_areas,
      partners: formData.partners,
      max_serving_per_month: parseInt(formData.max_serving_per_month),
      frequency_preference: formData.frequency_preference,
      priority_area: formData.priority_area,
      is_paused: false,
      notes: formData.notes,
      unavailable_dates: [],
    });
    toast.success(`${formData.full_name} added successfully!`);
    setFormData({
      full_name: "",
      email: "",
      phone: "",
      serving_areas: [],
      partners: [],
      max_serving_per_month: "2",
      frequency_preference: "2x/month",
      priority_area: "",
      notes: "",
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Add New Volunteer
          </DialogTitle>
          <DialogDescription>
            Create a new volunteer profile with all required information.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label className="text-xs">Full Name *</Label>
            <Input
              placeholder="John Smith"
              value={formData.full_name}
              onChange={(e) =>
                setFormData({ ...formData, full_name: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input
                placeholder="+1 555-0123"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
              />
            </div>
          </div>

          <div>
            <Label className="text-xs mb-2 block">Serving Areas</Label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border rounded-lg">
              {AREAS.map((a) => {
                const on = formData.serving_areas.includes(a);
                return (
                  <label
                    key={a}
                    className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={on}
                      onCheckedChange={() => {
                        const areas = on
                          ? formData.serving_areas.filter((x) => x !== a)
                          : [...formData.serving_areas, a];
                        setFormData({ ...formData, serving_areas: areas });
                      }}
                    />
                    <span className="truncate">{a}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Frequency</Label>
              <Select
                value={formData.frequency_preference}
                onValueChange={(v) =>
                  setFormData({ ...formData, frequency_preference: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1x/month">1× per month</SelectItem>
                  <SelectItem value="2x/month">2× per month</SelectItem>
                  <SelectItem value="fortnight">Every fortnight</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Max per month</Label>
              <Select
                value={formData.max_serving_per_month}
                onValueChange={(v) =>
                  setFormData({ ...formData, max_serving_per_month: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea
              placeholder="Any special notes or preferences..."
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            <Plus className="h-4 w-4 mr-2" />
            Add Volunteer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VolunteerSheet({
  volunteer,
  onClose,
}: {
  volunteer: Volunteer | null;
  onClose: () => void;
}) {
  const { assignments, updateVolunteer, togglePause, volunteers, dates } = useRoster();
  const [newUnavailableDate, setNewUnavailableDate] = useState("");
  
  if (!volunteer) return null;

  const upcoming = upcomingForPerson(volunteer.full_name, assignments);
  const today = startOfDay(new Date());

  const history = assignments
    .filter((a) => a.person_name.toLowerCase() === volunteer.full_name.toLowerCase())
    .filter((a) => !isAfter(parseISO(a.date), today))
    .sort((a, b) => b.date.localeCompare(a.date));

  const fatigue = computeFatigue(volunteer, assignments);
  const unavailableDates = volunteer.unavailable_dates || [];

  const toggleUnavailableDate = (dateStr: string) => {
    const current = new Set(unavailableDates);
    if (current.has(dateStr)) {
      current.delete(dateStr);
      toast.info(`Removed unavailable date ${dateStr}`);
    } else {
      current.add(dateStr);
      toast.success(`Marked ${dateStr} as unavailable`);
    }
    updateVolunteer(volunteer.id, {
      unavailable_dates: Array.from(current),
    });
  };

  const addUnavailableDate = () => {
    if (!newUnavailableDate) return;
    const current = new Set(unavailableDates);
    if (!current.has(newUnavailableDate)) {
      current.add(newUnavailableDate);
      updateVolunteer(volunteer.id, {
        unavailable_dates: Array.from(current),
      });
      toast.success("Unavailable date added");
      setNewUnavailableDate("");
    }
  };

  return (
    <Sheet open={!!volunteer} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-auto p-6">
        <SheetHeader className="px-0">
          <SheetTitle className="flex items-center gap-2">
            {volunteer.full_name}
            <StatusBadge status={fatigue.status} />
          </SheetTitle>
          <SheetDescription>Volunteer profile & serving schedule</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 mt-4">
          {/* Highlighted Schedule Card */}
          <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-primary" />
                Upcoming Schedule ({upcoming.length})
              </span>
              {volunteer.is_paused && (
                <span className="text-xs bg-status-amber text-status-amber-foreground px-2 py-0.5 rounded font-medium flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3" />
                  Paused
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              {upcoming.length === 0 ? (
                <div className="text-xs text-muted-foreground py-1">
                  No upcoming assignments scheduled.
                </div>
              ) : (
                upcoming.slice(0, 8).map((a) => {
                  const isUnavailable = unavailableDates.includes(a.date);
                  return (
                    <div
                      key={a.id}
                      className={`flex items-center justify-between text-xs rounded-lg border px-3 py-2 ${
                        isUnavailable
                          ? "bg-red-500/15 border-red-500/40"
                          : "bg-muted/40"
                      }`}
                    >
                      <span className="font-medium">
                        {format(parseISO(a.date), "EEE, d MMM yyyy")}
                        {isUnavailable && (
                          <span className="ml-2 text-red-600 font-semibold">
                            ⚠ UNAVAILABLE
                          </span>
                        )}
                      </span>
                      <span className="text-primary font-semibold truncate ml-2">
                        {a.label}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Unavailable Dates Section */}
          <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
            <div className="flex items-center gap-2">
              <CalendarX className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-semibold">Unavailable Dates</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={newUnavailableDate}
                  onChange={(e) => setNewUnavailableDate(e.target.value)}
                  className="flex-1 text-sm"
                />
                <Button
                  size="sm"
                  onClick={addUnavailableDate}
                  disabled={!newUnavailableDate}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2 max-h-32 overflow-auto p-2 border rounded-lg bg-muted/20">
                {unavailableDates.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2 text-center">
                    No unavailable dates set
                  </div>
                ) : (
                  unavailableDates
                    .sort()
                    .map((dateStr) => (
                      <div
                        key={dateStr}
                        className="flex items-center justify-between rounded-md border bg-card px-2 py-1.5 text-xs"
                      >
                        <span className="font-medium">
                          {format(parseISO(`${dateStr}T12:00:00`), "EEE, d MMM")}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                          onClick={() => toggleUnavailableDate(dateStr)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>

          <section className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Email</Label>
              <Input
                value={volunteer.email || ""}
                onChange={(e) => updateVolunteer(volunteer.id, { email: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input
                value={volunteer.phone || ""}
                onChange={(e) => updateVolunteer(volunteer.id, { phone: e.target.value })}
              />
            </div>
          </section>

          <section>
            <Label className="text-xs">Partner link</Label>
            <Select
              value={volunteer.partners[0] || "__none"}
              onValueChange={(val) =>
                updateVolunteer(volunteer.id, {
                  partners: val === "__none" ? [] : [val],
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select partner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— None —</SelectItem>
                {volunteers
                  .filter((v) => v.id !== volunteer.id)
                  .map((v) => (
                    <SelectItem key={v.id} value={v.full_name}>
                      {v.full_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </section>

          <section>
            <Label className="text-xs mb-2 block">Serving areas</Label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border rounded-lg">
              {AREAS.map((a) => {
                const on = volunteer.serving_areas.some(
                  (x) => x.toLowerCase() === a.toLowerCase(),
                );
                return (
                  <label
                    key={a}
                    className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={on}
                      onCheckedChange={() => {
                        const areas = on
                          ? volunteer.serving_areas.filter(
                              (x) => x.toLowerCase() !== a.toLowerCase(),
                            )
                          : [...volunteer.serving_areas, a];
                        updateVolunteer(volunteer.id, { serving_areas: areas });
                      }}
                    />
                    <span className="truncate">{a}</span>
                  </label>
                );
              })}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Frequency preference</Label>
              <Select
                value={volunteer.frequency_preference}
                onValueChange={(v) =>
                  updateVolunteer(volunteer.id, { frequency_preference: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1x/month">1× per month</SelectItem>
                  <SelectItem value="2x/month">2× per month</SelectItem>
                  <SelectItem value="fortnight">Every fortnight</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Max per month</Label>
              <Select
                value={String(volunteer.max_serving_per_month)}
                onValueChange={(v) =>
                  updateVolunteer(volunteer.id, {
                    max_serving_per_month: parseInt(v),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <section>
            <Label className="text-xs">Priority serving area</Label>
            <Select
              value={volunteer.priority_area || "__none"}
              onValueChange={(v) =>
                updateVolunteer(volunteer.id, {
                  priority_area: v === "__none" ? "" : v,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select priority area" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— None —</SelectItem>
                {volunteer.serving_areas.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          <section className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
            <div>
              <div className="text-sm font-medium">Pause serving</div>
              <div className="text-xs text-muted-foreground">
                Away or sick — future slots get flagged as needing replacement.
              </div>
            </div>
            <Switch
              checked={volunteer.is_paused}
              onCheckedChange={() => togglePause(volunteer.id)}
            />
          </section>

          <section>
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={volunteer.notes}
              onChange={(e) => updateVolunteer(volunteer.id, { notes: e.target.value })}
              rows={2}
            />
          </section>

          <section>
            <div className="text-sm font-semibold mb-2">Past History ({history.length})</div>
            <div className="space-y-1 max-h-36 overflow-auto">
              {history.slice(0, 20).map((a) => (
                <div
                  key={a.id}
                  className="flex justify-between text-xs rounded-md border px-2 py-1"
                >
                  <span>{format(parseISO(a.date), "d MMM yyyy")}</span>
                  <span className="text-muted-foreground truncate">{a.label}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
