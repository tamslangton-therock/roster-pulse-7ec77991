import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useRoster } from "@/lib/store";
import { computeFatigue } from "@/lib/roster-engine";
import type { FatigueStatus } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
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
          "Rolling 4-week and 8-week fatigue metrics, burnout risk detection, and under-utilization insights.",
      },
      { property: "og:title", content: "Team Health & Fatigue — Roster Pulse" },
      {
        property: "og:description",
        content:
          "Track burnout risk, consecutive streaks, and under-served volunteers with rolling metrics.",
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
  { value: "burnout", label: "Burnout risk" },
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

function HealthPage() {
  const { volunteers, assignments } = useRoster();
  const [statusFilter, setStatusFilter] = useState<FatigueStatus | "all">("all");
  const [minMonth, setMinMonth] = useState("");
  const [q, setQ] = useState("");

  const rows = useMemo(
    () =>
      volunteers.map((v) => {
        const f = computeFatigue(v, assignments);
        return { v, ...f };
      }),
    [volunteers, assignments],
  );

  const filtered = useMemo(() => {
    const min = parseInt(minMonth) || 0;
    const query = q.trim().toLowerCase();
    return rows
      .filter((r) => statusFilter === "all" || r.status === statusFilter)
      .filter((r) => r.monthCount >= min)
      .filter((r) => !query || r.v.full_name.toLowerCase().includes(query))
      .sort((a, b) => {
        const rank = (s: FatigueStatus) =>
          ({ burnout: 0, no_rest: 1, could_do_more: 2, inactive: 3, paused: 4, healthy: 5 })[s];
        return rank(a.status) - rank(b.status);
      });
  }, [rows, statusFilter, minMonth, q]);

  const kpis = useMemo(() => {
    const total = rows.filter((r) => !r.v.is_paused).length;
    const burnout = rows.filter((r) => r.status === "burnout").length;
    const under = rows.filter((r) => r.status === "could_do_more" || r.status === "inactive").length;
    const paused = rows.filter((r) => r.status === "paused").length;
    return { total, burnout, under, paused };
  }, [rows]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team Health & Fatigue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Rolling 4-week and 8-week engagement across all serving areas.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={Users}
          label="Active volunteers"
          value={kpis.total}
          tone="bg-status-green text-status-green-foreground"
        />
        <KpiCard
          icon={AlertTriangle}
          label="High burnout risk"
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as FatigueStatus | "all")}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FATIGUE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input
          type="number"
          min={0}
          placeholder="Min this month"
          value={minMonth}
          onChange={(e) => setMinMonth(e.target.value)}
          className="w-[160px]"
        />
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
              <TableHead className="text-center">This month</TableHead>
              <TableHead className="text-center">4-week</TableHead>
              <TableHead className="text-center">8-week</TableHead>
              <TableHead className="text-center">Streak</TableHead>
              <TableHead>Serving areas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.v.id}>
                <TableCell className="font-medium">{r.v.full_name}</TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
                <TableCell className="text-center">{r.monthCount}</TableCell>
                <TableCell className="text-center">{r.last4}</TableCell>
                <TableCell className="text-center">{r.last8}</TableCell>
                <TableCell className="text-center">
                  {r.streak > 1 ? `${r.streak}w` : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate">
                  {r.v.serving_areas.join(", ") || "—"}
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
    </div>
  );
}
