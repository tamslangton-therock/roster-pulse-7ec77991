import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useRoster } from "@/lib/store";
import type { FatigueStatus } from "@/lib/types";
import {
  DEFAULT_HEALTH_SETTINGS,
  MODE_OPTIONS,
  computeHealthRow,
  loadHealthSettings,
  saveHealthSettings,
  type HealthMode,
  type HealthSettings,
} from "@/lib/health-settings";
import { StatusBadge } from "@/components/status-badge";
import { VolunteerHistoryDrawer } from "@/components/volunteer-history-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Activity, AlertTriangle, Pause, TrendingDown, Users } from "lucide-react";

export const Route = createFileRoute("/health")({
  head: () => ({
    meta: [
      { title: "Team Health & Fatigue — Roster Pulse" },
      {
        name: "description",
        content:
          "Configurable fatigue lenses: preference-based load, rolling windows, custom date ranges and consecutive-week streaks.",
      },
      { property: "og:title", content: "Team Health & Fatigue — Roster Pulse" },
      {
        property: "og:description",
        content:
          "Filter volunteer health by preference, past or future weeks, custom months, or consecutive streaks.",
      },
    ],
  }),
  component: HealthPage,
});

const FATIGUE_OPTIONS: { value: FatigueStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "healthy", label: "Healthy" },
  { value: "could_do_more", label: "Could do more" },
  { value: "no_rest", label: "No rest weeks" },
  { value: "burnout", label: "Burnout risk / over-served" },
  { value: "paused", label: "Paused" },
  { value: "inactive", label: "Inactive" },
];

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${tone}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-3xl font-semibold tracking-tight mt-2">{value}</div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(Math.max(min, parseInt(e.target.value) || 0))}
      />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function HealthPage() {
  const { volunteers, assignments } = useRoster();
  const [statusFilter, setStatusFilter] = useState<FatigueStatus | "all">("all");
  const [q, setQ] = useState("");
  const [settings, setSettings] = useState<HealthSettings>(DEFAULT_HEALTH_SETTINGS);

  useEffect(() => {
    setSettings(loadHealthSettings());
  }, []);

  const patch = (p: Partial<HealthSettings>) =>
    setSettings((s) => {
      const next = { ...s, ...p };
      saveHealthSettings(next);
      return next;
    });

  const areas = useMemo(() => {
    const set = new Set<string>();
    volunteers.forEach((v) => v.serving_areas.forEach((a) => a && set.add(a)));
    return Array.from(set).sort();
  }, [volunteers]);

  const rows = useMemo(
    () =>
      volunteers
        .filter((v) => settings.includePaused || !v.is_paused)
        .filter(
          (v) =>
            settings.area === "all" ||
            v.serving_areas.some((a) => a.toLowerCase() === settings.area.toLowerCase()),
        )
        .map((v) => computeHealthRow(v, assignments, settings)),
    [volunteers, assignments, settings],
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows
      .filter((r) => statusFilter === "all" || r.status === statusFilter)
      .filter((r) => !query || r.volunteer.full_name.toLowerCase().includes(query))
      .sort((a, b) => {
        const rank = (s: FatigueStatus) =>
          ({ burnout: 0, no_rest: 1, could_do_more: 2, inactive: 3, paused: 4, healthy: 5 })[s];
        const d = rank(a.status) - rank(b.status);
        return d !== 0 ? d : b.count - a.count;
      });
  }, [rows, statusFilter, q]);

  const kpis = useMemo(() => {
    const total = rows.filter((r) => r.status !== "paused").length;
    const burnout = rows.filter((r) => r.status === "burnout").length;
    const under = rows.filter((r) => r.status === "could_do_more" || r.status === "inactive").length;
    const paused = volunteers.filter((v) => v.is_paused).length;
    return { total, burnout, under, paused };
  }, [rows, volunteers]);

  const modeMeta = MODE_OPTIONS.find((m) => m.value === settings.mode)!;
  const countModes = settings.mode !== "consecutive" && settings.mode !== "preference";

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team Health & Fatigue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Lens: <span className="font-medium text-foreground">{modeMeta.label}</span> — {modeMeta.hint}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={Users}
          label="Volunteers in view"
          value={kpis.total}
          tone="bg-status-green text-status-green-foreground"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Over-served / burnout"
          value={kpis.burnout}
          tone="bg-status-red text-status-red-foreground"
        />
        <KpiCard
          icon={TrendingDown}
          label="Under-utilized"
          value={kpis.under}
          tone="bg-status-yellow text-status-yellow-foreground"
        />
        <KpiCard
          icon={Pause}
          label="Paused"
          value={kpis.paused}
          tone="bg-status-blue text-status-blue-foreground"
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as FatigueStatus | "all")}
              >
                <SelectTrigger className="w-[230px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FATIGUE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Select value={settings.area} onValueChange={(v) => patch({ area: v })}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Serving area" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All serving areas</SelectItem>
                {areas.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Search name…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-[220px]"
            />
          </div>

          <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Volunteer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">
                    {settings.mode === "consecutive" ? "Streak" : "Serves"}
                  </TableHead>
                  {settings.mode === "preference" && (
                    <TableHead className="text-center">Target /mo</TableHead>
                  )}
                  <TableHead className="text-center">Streak</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead>Serving areas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.volunteer.id}>
                    <TableCell className="font-medium">{r.volunteer.full_name}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-center">
                      {settings.mode === "consecutive" ? (r.streak > 1 ? `${r.streak}w` : "—") : r.count}
                    </TableCell>
                    {settings.mode === "preference" && (
                      <TableCell className="text-center">{r.target}</TableCell>
                    )}
                    <TableCell className="text-center">
                      {r.streak > 1 ? `${r.streak}w` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.detail}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate">
                      {r.volunteer.serving_areas.join(", ") || "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                      No volunteers match your filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <div className="rounded-xl border bg-card p-6 shadow-sm space-y-6 max-w-3xl">
            <div className="space-y-1.5">
              <Label className="text-xs">Health lens</Label>
              <Select
                value={settings.mode}
                onValueChange={(v) => patch({ mode: v as HealthMode })}
              >
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODE_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">{modeMeta.hint}</p>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              {settings.mode === "past" && (
                <NumberField
                  label="Look back (weeks)"
                  min={1}
                  value={settings.pastWeeks}
                  onChange={(n) => patch({ pastWeeks: n })}
                />
              )}
              {settings.mode === "future" && (
                <NumberField
                  label="Look ahead (weeks)"
                  min={1}
                  value={settings.futureWeeks}
                  onChange={(n) => patch({ futureWeeks: n })}
                />
              )}
              {settings.mode === "range" && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Start date</Label>
                    <Input
                      type="date"
                      value={settings.rangeStart}
                      onChange={(e) => patch({ rangeStart: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">End date</Label>
                    <Input
                      type="date"
                      value={settings.rangeEnd}
                      onChange={(e) => patch({ rangeEnd: e.target.value })}
                    />
                  </div>
                </>
              )}
              {countModes && (
                <>
                  <NumberField
                    label="Over-served at (serves ≥)"
                    min={1}
                    value={settings.highThreshold}
                    onChange={(n) => patch({ highThreshold: n })}
                    hint="Flags red"
                  />
                  <NumberField
                    label="Could do more at (serves ≤)"
                    value={settings.lowThreshold}
                    onChange={(n) => patch({ lowThreshold: n })}
                    hint="Flags yellow"
                  />
                </>
              )}
              {settings.mode === "preference" && (
                <NumberField
                  label="Tolerance above preference (%)"
                  value={settings.tolerancePct}
                  onChange={(n) => patch({ tolerancePct: n })}
                  hint="How far over their requested frequency is still OK"
                />
              )}
              <NumberField
                label="Burnout streak (weeks in a row)"
                min={2}
                value={settings.burnoutStreak}
                onChange={(n) => patch({ burnoutStreak: n })}
              />
              {settings.mode === "consecutive" && (
                <NumberField
                  label="No-rest streak (weeks in a row)"
                  min={1}
                  value={settings.noRestStreak}
                  onChange={(n) => patch({ noRestStreak: n })}
                />
              )}
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <div>
                <Label className="text-sm">Include paused volunteers</Label>
                <p className="text-[11px] text-muted-foreground">
                  Show people who have paused serving in the table.
                </p>
              </div>
              <Switch
                checked={settings.includePaused}
                onCheckedChange={(c) => patch({ includePaused: c })}
              />
            </div>

            <div className="flex justify-end border-t pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  saveHealthSettings(DEFAULT_HEALTH_SETTINGS);
                  setSettings(DEFAULT_HEALTH_SETTINGS);
                }}
              >
                Reset to defaults
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
