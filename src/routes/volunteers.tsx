import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Search } from "lucide-react";

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
  const { volunteers, assignments } = useRoster();
  const [q, setQ] = useState("");
  const [areaFilter, setAreaFilter] = useState("all");
  const [selected, setSelected] = useState<Volunteer | null>(null);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return volunteers.filter((v) => {
      if (query && !v.full_name.toLowerCase().includes(query)) return false;
      if (
        areaFilter !== "all" &&
        !v.serving_areas.some((a) => a.toLowerCase() === areaFilter.toLowerCase())
      )
        return false;
      return true;
    });
  }, [volunteers, q, areaFilter]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Volunteers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} of {volunteers.length} people
          </p>
        </div>
        <div className="flex items-center gap-2 w-full max-w-md">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={areaFilter} onValueChange={setAreaFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Serving area" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All areas</SelectItem>
              {AREAS.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.map((v) => {
          const f = computeFatigue(v, assignments);
          return (
            <button
              key={v.id}
              onClick={() => setSelected(v)}
              className="text-left rounded-xl border bg-card p-4 hover:shadow-md hover:border-ring/40 transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{v.full_name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {v.serving_areas.slice(0, 3).join(" · ") || "—"}
                  </div>
                </div>
                <StatusBadge status={f.status} showEmoji />
              </div>
              <div className="flex items-center gap-3 mt-3 text-[11px] text-muted-foreground">
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
    </div>
  );
}

function VolunteerSheet({
  volunteer,
  onClose,
}: {
  volunteer: Volunteer | null;
  onClose: () => void;
}) {
  const { assignments, updateVolunteer, togglePause, volunteers } = useRoster();
  if (!volunteer) return null;
  const upcoming = upcomingForPerson(volunteer.full_name, assignments);
  const history = assignments
    .filter((a) => a.person_name.toLowerCase() === volunteer.full_name.toLowerCase())
    .filter((a) => new Date(a.date) < new Date())
    .sort((a, b) => b.date.localeCompare(a.date));

  const fatigue = computeFatigue(volunteer, assignments);

  return (
    <Sheet open={!!volunteer} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-auto p-6">
        <SheetHeader className="px-0">
          <SheetTitle className="flex items-center gap-2">
            {volunteer.full_name}
            <StatusBadge status={fatigue.status} />
          </SheetTitle>
          <SheetDescription>Volunteer profile & preferences</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 mt-4">
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
            <div className="grid grid-cols-2 gap-2">
              {AREAS.map((a) => {
                const on = volunteer.serving_areas.some(
                  (x) => x.toLowerCase() === a.toLowerCase(),
                );
                return (
                  <label
                    key={a}
                    className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
                  >
                    <Checkbox
                      checked={on}
                      onCheckedChange={(v) => {
                        const areas = on
                          ? volunteer.serving_areas.filter(
                              (x) => x.toLowerCase() !== a.toLowerCase(),
                            )
                          : [...volunteer.serving_areas, a];
                        updateVolunteer(volunteer.id, { serving_areas: areas });
                        void v;
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
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
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
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          <section className="flex items-center justify-between rounded-lg border p-3">
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
            <div className="text-sm font-semibold mb-2">Upcoming ({upcoming.length})</div>
            <div className="space-y-1">
              {upcoming.length === 0 && (
                <div className="text-xs text-muted-foreground">No upcoming assignments.</div>
              )}
              {upcoming.slice(0, 8).map((a) => (
                <div
                  key={a.id}
                  className="flex justify-between text-xs rounded-md bg-muted px-2 py-1.5"
                >
                  <span>{format(parseISO(a.date), "d MMM")}</span>
                  <span className="text-muted-foreground truncate">{a.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="text-sm font-semibold mb-2">History ({history.length})</div>
            <div className="space-y-1 max-h-40 overflow-auto">
              {history.slice(0, 20).map((a) => (
                <div
                  key={a.id}
                  className="flex justify-between text-xs rounded-md border px-2 py-1"
                >
                  <span>{format(parseISO(a.date), "d MMM")}</span>
                  <span className="text-muted-foreground truncate">{a.label}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
