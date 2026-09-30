import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  Users2,
  Check,
  Minus,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRoster } from "@/lib/store";
import {
  suggestRoster,
  type AiRosterResult,
  type AiRosterSuggestion,
} from "@/lib/ai-roster.functions";

const TAG_BADGES: Record<string, { label: string; className: string }> = {
  sub_team: {
    label: "🧩 Sub-team",
    className: "bg-indigo-100 text-indigo-800 border-indigo-200",
  },
  partner_aligned: {
    label: "👥 Partner aligned",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  frequency_match: {
    label: "🎯 Frequency match",
    className: "bg-sky-100 text-sky-800 border-sky-200",
  },
  rested: {
    label: "✅ Rested",
    className: "bg-teal-100 text-teal-800 border-teal-200",
  },
  priority_area: {
    label: "⭐ Priority area",
    className: "bg-amber-100 text-amber-900 border-amber-200",
  },
  fair_rotation: {
    label: "🔄 Fair rotation",
    className: "bg-violet-100 text-violet-800 border-violet-200",
  },
  allowed_clash_ok: {
    label: "✔ Allowed pairing",
    className: "bg-stone-100 text-stone-700 border-stone-200",
  },
  proven_role: {
    label: "🏆 Proven role",
    className: "bg-rose-100 text-rose-800 border-rose-200",
  },
};

const todayISO = () => new Date().toISOString().slice(0, 10);

interface AiRosterDialogProps {
  disabled?: boolean;
}

export function AiRosterDialog({ disabled }: AiRosterDialogProps) {
  const [open, setOpen] = useState(false);
  const volunteers = useRoster((s) => s.volunteers);
  const slots = useRoster((s) => s.slots);
  const blockouts = useRoster((s) => s.blockouts);
  const allowedClashes = useRoster((s) => s.allowedClashes);
  const assignments = useRoster((s) => s.assignments);
  const dates = useRoster((s) => s.dates);
  const subTeams = useRoster((s) => s.subTeams);
  const addRosterDate = useRoster((s) => s.addRosterDate);
  const assignSlot = useRoster((s) => s.assignSlot);
  const clearSlot = useRoster((s) => s.clearSlot);

  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [selectedAreas, setSelectedAreas] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"fill_empty" | "draft_full">("fill_empty");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiRosterResult | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [targetOverrides, setTargetOverrides] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");

  const today = todayISO();
  const upcoming = useMemo(
    () => dates.filter((d) => d >= today).sort(),
    [dates, today],
  );

  const byMonth = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const d of upcoming) {
      const key = d.slice(0, 7);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(d);
    }
    return Array.from(m.entries());
  }, [upcoming]);

  const areas = useMemo(() => {
    const set = new Set<string>();
    for (const s of slots) set.add(s.area);
    return Array.from(set).sort();
  }, [slots]);

  /** Active, roster-eligible volunteers qualified for an area. */
  const qualifiedByArea = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const area of areas) {
      map.set(
        area,
        volunteers
          .filter(
            (v) =>
              v.is_volunteer !== false &&
              !v.is_paused &&
              (v.serving_areas ?? []).some(
                (a) => a.toLowerCase() === area.toLowerCase(),
              ),
          )
          .map((v) => v.full_name)
          .sort(),
      );
    }
    return map;
  }, [volunteers, areas]);

  const scopedSlots = useMemo(
    () =>
      slots.filter(
        (s) => selectedAreas.size === 0 || selectedAreas.has(s.area),
      ),
    [slots, selectedAreas],
  );

  /** Typical headcount per area per Sunday, learned from past Sundays (median of the last 12). */
  const defaultTargets = useMemo(() => {
    const slotArea = new Map(slots.map((s) => [s.label, s.area] as const));
    const pastDates = Array.from(
      new Set(
        assignments.filter((a) => a.date < today).map((a) => a.date),
      ),
    )
      .sort()
      .slice(-12);
    const counts = new Map<string, number[]>();
    for (const d of pastDates) {
      const perArea = new Map<string, Set<string>>();
      for (const a of assignments) {
        if (a.date !== d) continue;
        const area = slotArea.get(a.label);
        if (!area) continue;
        if (!perArea.has(area)) perArea.set(area, new Set());
        perArea.get(area)!.add(a.person_name.toLowerCase());
      }
      for (const [area, people] of perArea) {
        if (!counts.has(area)) counts.set(area, []);
        counts.get(area)!.push(people.size);
      }
    }
    const res: Record<string, number> = {};
    for (const area of areas) {
      const arr = (counts.get(area) ?? []).sort((a, b) => a - b);
      if (arr.length === 0) {
        res[area] = slots.filter((s) => s.area === area).length;
      } else {
        const mid = Math.floor(arr.length / 2);
        const median =
          arr.length % 2 ? arr[mid] : Math.round((arr[mid - 1] + arr[mid]) / 2);
        res[area] = Math.max(1, median);
      }
    }
    return res;
  }, [assignments, slots, areas, today]);

  /** Ideal sub-teams grouped from the Team Builder. */
  const subTeamGroups = useMemo(() => {
    const m = new Map<
      string,
      { area: string; name: string; members: { slot_label: string; person_name: string }[] }
    >();
    for (const st of subTeams) {
      const key = `${st.serving_area}||${st.sub_team_name}`;
      if (!m.has(key))
        m.set(key, { area: st.serving_area, name: st.sub_team_name, members: [] });
      m.get(key)!.members.push({ slot_label: st.slot_label, person_name: st.person_name });
    }
    return Array.from(m.values()).filter((g) => g.members.length > 0);
  }, [subTeams]);

  /** Verified candidate pool per slot label: qualified by area + sub-team members. */
  const slotCandidates = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const slot of slots) {
      const set = new Map<string, string>(); // lower -> canonical
      for (const n of qualifiedByArea.get(slot.area) ?? []) {
        set.set(n.toLowerCase(), n);
      }
      for (const st of subTeams) {
        if (st.slot_label !== slot.label) continue;
        const v = volunteers.find(
          (x) =>
            x.full_name.toLowerCase() === st.person_name.toLowerCase() &&
            x.is_volunteer !== false &&
            !x.is_paused,
        );
        if (v) set.set(st.person_name.toLowerCase(), st.person_name);
      }
      map.set(slot.label, Array.from(set.values()).sort());
    }
    return map;
  }, [slots, qualifiedByArea, subTeams, volunteers]);

  /** Exact slots each person has actually served in the last 12 weeks. */
  const provenRoles = useMemo(() => {
    const cutoff = new Date(Date.now() - 84 * 86400000).toISOString().slice(0, 10);
    const m = new Map<string, Set<string>>();
    const canon = new Map<string, string>();
    for (const a of assignments) {
      if (a.date >= today || a.date < cutoff) continue;
      const key = a.person_name.toLowerCase();
      if (!m.has(key)) m.set(key, new Set());
      m.get(key)!.add(a.label);
      canon.set(key, a.person_name);
    }
    return Array.from(m.entries())
      .map(([key, set]) => ({ name: canon.get(key) ?? key, slots: Array.from(set) }))
      .filter((r) => r.slots.length > 0);
  }, [assignments, today]);

  /** Pairs who regularly served together in the same area (co-serving chemistry). */
  const affinity = useMemo(() => {
    const slotArea = new Map(slots.map((s) => [s.label, s.area] as const));
    const pastDates = Array.from(
      new Set(assignments.filter((a) => a.date < today).map((a) => a.date)),
    )
      .sort()
      .slice(-12);
    const pairCount = new Map<string, number>();
    const canon = new Map<string, string>();
    for (const d of pastDates) {
      const perArea = new Map<string, string[]>();
      for (const a of assignments) {
        if (a.date !== d) continue;
        const area = slotArea.get(a.label);
        if (!area) continue;
        if (!perArea.has(area)) perArea.set(area, []);
        perArea.get(area)!.push(a.person_name);
        canon.set(a.person_name.toLowerCase(), a.person_name);
      }
      for (const [, people] of perArea) {
        const uniq = Array.from(new Set(people.map((p) => p.toLowerCase())));
        for (let i = 0; i < uniq.length; i++) {
          for (let j = i + 1; j < uniq.length; j++) {
            const key = `${uniq[i]}||${uniq[j]}`;
            pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
          }
        }
      }
    }
    return Array.from(pairCount.entries())
      .filter(([, times]) => times >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 80)
      .map(([key, times]) => {
        const [a, b] = key.split("||");
        return {
          area: "",
          people: [canon.get(a) ?? a, canon.get(b) ?? b],
          times,
        };
      });
  }, [assignments, slots, today]);

  const toggleDate = (d: string, on: boolean) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (on) next.add(d);
      else next.delete(d);
      return next;
    });
  };

  const toggleMonth = (monthDates: string[]) => {
    setSelectedDates((prev) => {
      const allOn = monthDates.every((d) => prev.has(d));
      const next = new Set(prev);
      for (const d of monthDates) {
        if (allOn) next.delete(d);
        else next.add(d);
      }
      return next;
    });
  };

  const reset = () => {
    setError(null);
    setResult(null);
    setOverrides({});
    setTargetOverrides({});
    setNotes("");
  };

  const generate = async () => {
    if (selectedDates.size === 0) return;
    setGenerating(true);
    setError(null);
    setResult(null);
    setOverrides({});
    try {
      const active = volunteers
        .filter((v) => v.is_volunteer !== false && !v.is_paused)
        .map((v) => ({
          name: v.full_name,
          areas: v.serving_areas ?? [],
          freq: v.frequency_preference ?? "",
          max: v.max_serving_per_month ?? 2,
          partners: v.partners ?? [],
          priority: v.priority_area ?? "",
        }));

      const recent = volunteers
        .filter((v) => v.is_volunteer !== false)
        .map((v) => {
          const mine = assignments.filter(
            (a) =>
              a.person_name.toLowerCase() === v.full_name.toLowerCase() &&
              a.date < today &&
              a.date >= new Date(Date.now() - 56 * 86400000).toISOString().slice(0, 10),
          );
          const last = mine.map((a) => a.date).sort().pop() ?? "";
          return { name: v.full_name, count8w: mine.length, lastServed: last };
        })
        .filter((r) => r.count8w > 0);

      const dateList = Array.from(selectedDates).sort();
      const dateSet = new Set(dateList);
      const scopedAreaSet = new Set(scopedSlots.map((s) => s.area));

      const payload = {
        dates: dateList,
        mode,
        volunteers: active,
        slots: scopedSlots.map((s) => ({
          label: s.label,
          area: s.area,
          role: s.role,
        })),
        targets: areas
          .filter((a) => scopedAreaSet.has(a))
          .map((a) => ({
            area: a,
            target: targetOverrides[a] ?? defaultTargets[a] ?? 0,
          })),
        subTeams: subTeamGroups
          .filter((g) => scopedAreaSet.has(g.area))
          .map((g) => ({
            area: g.area,
            name: g.name,
            members: g.members.filter((m) =>
              scopedSlots.some((s) => s.label === m.slot_label),
            ),
          }))
          .filter((g) => g.members.length > 0),
        candidates: scopedSlots.map((s) => ({
          slot_label: s.label,
          people: slotCandidates.get(s.label) ?? [],
        })),
        provenRoles,
        affinity,
        blockouts: blockouts
          .filter((b) => dateSet.has(b.date))
          .map((b) => ({
            person_name: b.person_name,
            date: b.date,
            reason: b.reason ?? "",
          })),
        allowedClashes: allowedClashes.map((c) => ({
          area_a: c.area_a,
          area_b: c.area_b,
        })),
        existing: assignments
          .filter((a) => dateSet.has(a.date))
          .map((a) => ({
            date: a.date,
            label: a.label,
            person_name: a.person_name,
          })),
        recent,
        priorities: notes.trim() || undefined,
      };

      const res = await suggestRoster({ data: payload });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  };

  const keyOf = (s: AiRosterSuggestion) => `${s.date}||${s.slot_label}`;

  const apply = () => {
    if (!result) return;
    const valid = new Set(scopedSlots.map((s) => s.label));
    const cleared = new Set<string>();
    for (const s of result.suggestions) {
      if (!valid.has(s.slot_label)) continue;
      if (!selectedDates.has(s.date)) continue;
      const slot = slots.find((x) => x.label === s.slot_label);
      if (!slot) continue;
      const chosen = overrides[keyOf(s)] || s.person_name;
      if (!chosen) continue;
      // Safety filter: the person must be in the verified candidate pool for
      // this exact slot (case-insensitive match onto the canonical name).
      const pool = slotCandidates.get(s.slot_label) ?? [];
      const canonical =
        pool.find((n) => n.toLowerCase() === chosen.toLowerCase()) ?? "";
      if (!canonical) continue;
      if (mode === "draft_full" && !cleared.has(s.date)) {
        for (const sl of scopedSlots) clearSlot(s.date, sl.label);
        cleared.add(s.date);
      }
      if (!dates.includes(s.date)) addRosterDate(s.date);
      assignSlot(s.date, s.slot_label, canonical);
    }
    setOpen(false);
    reset();
    setSelectedDates(new Set());
  };

  const grouped = useMemo(() => {
    if (!result) return [];
    const m = new Map<string, AiRosterSuggestion[]>();
    for (const s of result.suggestions) {
      if (!m.has(s.date)) m.set(s.date, []);
      m.get(s.date)!.push(s);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [result]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Sparkles className="h-4 w-4 mr-1.5" />
          AI Roster
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl h-[88vh] max-h-[88vh] flex flex-col overflow-hidden p-4 sm:p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle>AI Auto-Roster</DialogTitle>
          <DialogDescription>
            Pick service dates and staffing scope, then review the AI's
            suggested assignments before applying anything. Suggestions follow
            your sub-teams, proven roles and typical team sizes.
          </DialogDescription>
        </DialogHeader>

        {!result && (
          <div className="flex-1 min-h-0 overflow-y-auto pr-2 -mr-1">
            <div className="space-y-5 py-1">
              {/* Dates */}
              <div>
                <Label className="text-sm font-medium">Service dates</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Upcoming Sundays from your roster.
                </p>
                <div className="space-y-2">
                  {byMonth.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No upcoming dates yet — use "Add Date" first.
                    </p>
                  )}
                  {byMonth.map(([month, monthDates]) => (
                    <div key={month} className="rounded-md border p-2.5">
                      <button
                        type="button"
                        className="text-sm font-medium hover:underline"
                        onClick={() => toggleMonth(monthDates)}
                      >
                        {format(parseISO(`${month}-01T12:00:00`), "MMMM yyyy")}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          toggle all
                        </span>
                      </button>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {monthDates.map((d) => (
                          <label
                            key={d}
                            className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm cursor-pointer hover:bg-accent"
                          >
                            <Checkbox
                              checked={selectedDates.has(d)}
                              onCheckedChange={(v) => toggleDate(d, v === true)}
                            />
                            {format(parseISO(`${d}T12:00:00`), "EEE d MMM")}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Areas + staffing targets */}
              <div>
                <Label className="text-sm font-medium">Staffing needs</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Leave all unticked to include every serving area. The number
                  is how many people that area normally needs on a Sunday
                  (learned from recent Sundays) — extra slots stay as backup
                  and won't be force-filled.
                </p>
                <div className="space-y-1.5">
                  {areas.map((a) => {
                    const slotCount = slots.filter((s) => s.area === a).length;
                    const target =
                      targetOverrides[a] ?? defaultTargets[a] ?? slotCount;
                    const capped = Math.min(slotCount, Math.max(1, target));
                    return (
                      <div
                        key={a}
                        className="flex items-center gap-2 rounded-md border px-2.5 py-1.5"
                      >
                        <Checkbox
                          checked={selectedAreas.has(a)}
                          onCheckedChange={(v) =>
                            setSelectedAreas((prev) => {
                              const next = new Set(prev);
                              if (v === true) next.add(a);
                              else next.delete(a);
                              return next;
                            })
                          }
                        />
                        <span className="flex-1 text-sm">{a}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {capped} of {slotCount} slot{slotCount === 1 ? "" : "s"}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() =>
                            setTargetOverrides((prev) => ({
                              ...prev,
                              [a]: Math.max(1, capped - 1),
                            }))
                          }
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-5 text-center text-sm tabular-nums">
                          {capped}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() =>
                            setTargetOverrides((prev) => ({
                              ...prev,
                              [a]: Math.min(slotCount, capped + 1),
                            }))
                          }
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Optional notes */}
              <div>
                <Label className="text-sm font-medium" htmlFor="ai-notes">
                  Notes for the AI (optional)
                </Label>
                <Input
                  id="ai-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Prioritise the car park on 5 Oct, skip tea team this month"
                  className="mt-1.5"
                />
              </div>

              {/* Mode */}
              <div>
                <Label className="text-sm font-medium">Draft mode</Label>
                <RadioGroup
                  value={mode}
                  onValueChange={(v) =>
                    setMode(v as "fill_empty" | "draft_full")
                  }
                  className="mt-2"
                >
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="fill_empty" id="mode-fill" />
                    <Label htmlFor="mode-fill" className="font-normal">
                      <span className="block text-sm">Fill empty slots only</span>
                      <span className="block text-xs text-muted-foreground">
                        Keeps everyone already rostered.
                      </span>
                    </Label>
                  </div>
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="draft_full" id="mode-full" />
                    <Label htmlFor="mode-full" className="font-normal">
                      <span className="block text-sm">Draft full month</span>
                      <span className="block text-xs text-muted-foreground">
                        Re-drafts the selected dates from scratch.
                      </span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </ScrollArea>
        )}

        {result && (
          <ScrollArea className="max-h-[55vh] pr-3">
            <div className="space-y-4 py-1">
              {result.summary && (
                <p className="text-sm text-muted-foreground">{result.summary}</p>
              )}
              {grouped.map(([date, list]) => (
                <div key={date} className="rounded-md border">
                  <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
                    <span className="text-sm font-medium">
                      {format(parseISO(`${date}T12:00:00`), "EEEE d MMMM yyyy")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {list.length} suggestion{list.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="divide-y">
                    {list.map((s) => {
                      const slot = slots.find((x) => x.label === s.slot_label);
                      const qualified = slot
                        ? slotCandidates.get(slot.label) ?? []
                        : [];
                      const chosen =
                        overrides[keyOf(s)] || s.person_name || "";
                      return (
                        <div
                          key={keyOf(s)}
                          className="flex items-center gap-3 px-3 py-2"
                        >
                          <Users2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <Select
                              value={chosen}
                              onValueChange={(v) =>
                                setOverrides((prev) => ({
                                  ...prev,
                                  [keyOf(s)]: v,
                                }))
                              }
                            >
                              <SelectTrigger className="h-8 w-full max-w-56 text-sm">
                                <SelectValue placeholder="Choose person" />
                              </SelectTrigger>
                              <SelectContent>
                                {qualified.map((n) => (
                                  <SelectItem key={n} value={n}>
                                    {n}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                            {slot?.label}
                          </span>
                          <div className="flex flex-wrap justify-end gap-1">
                            {(s.reason_tags ?? []).map((t) => {
                              const b = TAG_BADGES[t];
                              return b ? (
                                <Badge
                                  key={t}
                                  variant="outline"
                                  className={`text-[11px] ${b.className}`}
                                >
                                  {b.label}
                                </Badge>
                              ) : null;
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {result.unfilled.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
                    <AlertTriangle className="h-4 w-4" />
                    Could not fill {result.unfilled.length} slot
                    {result.unfilled.length === 1 ? "" : "s"}
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {result.unfilled.map((u) => (
                      <li
                        key={`${u.date}||${u.slot_label}`}
                        className="text-xs text-amber-900"
                      >
                        {format(parseISO(`${u.date}T12:00:00`), "EEE d MMM")} —{" "}
                        {u.slot_label}: {u.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <DialogFooter className="gap-2">
          {result && (
            <Button variant="ghost" onClick={reset} disabled={generating}>
              Back
            </Button>
          )}
          {result ? (
            <Button onClick={apply}>
              <Check className="h-4 w-4 mr-1.5" />
              Apply to Live Roster
            </Button>
          ) : (
            <Button
              onClick={generate}
              disabled={generating || selectedDates.size === 0}
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Drafting…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  Generate suggestions
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
