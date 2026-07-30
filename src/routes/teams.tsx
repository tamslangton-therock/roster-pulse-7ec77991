import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarPlus, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRoster } from "@/lib/store";
import { ROSTER_AREAS, ROSTER_SLOTS } from "@/lib/roster-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { resolveSubTeamColor, PASTEL_SWATCHES } from "@/lib/person-colors";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const Route = createFileRoute("/teams")({
  head: () => ({
    meta: [
      { title: "Team Builder — Roster Pulse" },
      {
        name: "description",
        content:
          "Build ideal sub-teams inside each serving area and push them onto any Sunday of the live roster.",
      },
      { property: "og:title", content: "Team Builder — Roster Pulse" },
      {
        property: "og:description",
        content:
          "Group volunteers into repeatable sub-teams per serving area, synced live with Google Sheets.",
      },
    ],
  }),
  component: TeamsPage,
});

const NONE = "__none__";

function TeamsPage() {
  const {
    subTeams,
    volunteers,
    dates,
    addSubTeam,
    removeSubTeam,
    renameSubTeam,
    setSubTeamColor,

    setSubTeamSlot,
    applySubTeamToDate,
  } = useRoster();

  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [newFor, setNewFor] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const areas = useMemo(
    () => (selectedArea === "all" ? ROSTER_AREAS : [selectedArea]),
    [selectedArea],
  );

  const byArea = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of subTeams) {
      const list = map.get(r.serving_area) ?? [];
      if (!list.includes(r.sub_team_name)) list.push(r.sub_team_name);
      map.set(r.serving_area, list);
    }
    for (const [, list] of map) list.sort((a, b) => a.localeCompare(b));
    return map;
  }, [subTeams]);

  const totalSubTeams = useMemo(
    () => Array.from(byArea.values()).reduce((n, l) => n + l.length, 0),
    [byArea],
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team Builder</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalSubTeams} sub-teams across {ROSTER_AREAS.length} serving areas — saved to
            the <span className="font-medium">Sub_Teams</span> tab in Google Sheets.
          </p>
        </div>

        <Select value={selectedArea} onValueChange={setSelectedArea}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter area" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All serving areas</SelectItem>
            {ROSTER_AREAS.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {areas.map((area) => {
          const slots = ROSTER_SLOTS.filter((s) => s.area === area);
          const names = byArea.get(area) ?? [];
          return (
            <section key={area} className="rounded-xl border bg-card p-4 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{area}</div>
                  <div className="text-xs text-muted-foreground">
                    {slots.length} slot{slots.length === 1 ? "" : "s"} ·{" "}
                    {names.length} sub-team{names.length === 1 ? "" : "s"}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setNewFor(area);
                    setNewName(`${area} Team ${names.length + 1}`);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Sub-team
                </Button>
              </div>

              {names.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No sub-teams yet. Create one to group an ideal line-up for {area}.
                </p>
              )}

              {names.map((name) => (
                <SubTeamCard
                  key={`${area}::${name}`}
                  area={area}
                  name={name}
                  slots={slots}
                  rows={subTeams.filter(
                    (r) => r.serving_area === area && r.sub_team_name === name,
                  )}
                  volunteers={volunteers}
                  dates={dates}
                  colorId={
                    subTeams.find(
                      (r) =>
                        r.serving_area === area &&
                        r.sub_team_name === name &&
                        r.color,
                    )?.color
                  }
                  onSetColor={(id) => setSubTeamColor(area, name, id)}
                  onSetSlot={(label, person) => setSubTeamSlot(area, name, label, person)}
                  onRename={(next) => {
                    if (!next.trim() || next === name) return;
                    renameSubTeam(area, name, next.trim());
                  }}
                  onRemove={() => {
                    removeSubTeam(area, name);
                    toast.info(`Removed ${name}`);
                  }}
                  onApply={(date) => {
                    const n = applySubTeamToDate(area, name, date);
                    toast.success(
                      `${name} applied to ${format(parseISO(date), "d MMM yyyy")}`,
                      { description: `${n} slot${n === 1 ? "" : "s"} filled — override any slot on the Live Roster.` },
                    );
                  }}
                />
              ))}
            </section>
          );
        })}
      </div>

      <Dialog open={!!newFor} onOpenChange={(o) => !o && setNewFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New sub-team</DialogTitle>
            <DialogDescription>
              An ideal line-up inside {newFor}. You can still override people on the Live
              Roster.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Sub-team name"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFor(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!newFor || !newName.trim()) return;
                addSubTeam(newFor, newName.trim());
                setNewFor(null);
                toast.success("Sub-team created");
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SubTeamCard({
  area,
  name,
  slots,
  rows,
  volunteers,
  dates,
  onSetSlot,
  onRename,
  onRemove,
  onApply,
}: {
  area: string;
  name: string;
  slots: Array<{ label: string; role: string }>;
  rows: Array<{ slot_label: string; person_name: string }>;
  volunteers: import("@/lib/types").Volunteer[];
  dates: string[];
  onSetSlot: (label: string, person: string) => void;
  onRename: (next: string) => void;
  onRemove: () => void;
  onApply: (date: string) => void;
  colorId?: string;
  onSetColor: (id: string) => void;
}) {
  const color = resolveSubTeamColor(area, name, colorId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [applyDate, setApplyDate] = useState("");

  const personFor = (label: string) =>
    rows.find((r) => r.slot_label === label)?.person_name ?? "";

  const candidates = useMemo(() => {
    const inArea = volunteers.filter((v) =>
      v.serving_areas.some((a) => a.toLowerCase() === area.toLowerCase()),
    );
    const rest = volunteers.filter((v) => !inArea.includes(v));
    return [...inArea, ...rest].sort(
      (a, b) => Number(b.serving_areas.some((x) => x.toLowerCase() === area.toLowerCase())) -
        Number(a.serving_areas.some((x) => x.toLowerCase() === area.toLowerCase())) ||
        a.full_name.localeCompare(b.full_name),
    );
  }, [volunteers, area]);

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return dates.filter((d) => d >= today).slice(0, 30);
  }, [dates]);

  return (
    <div
      className="rounded-lg border bg-background p-3 space-y-3"
      style={{ borderLeft: `5px solid ${color.border}` }}
    >
      <div className="flex items-center justify-between gap-2">
        {editing ? (
          <div className="flex items-center gap-1 flex-1">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-8 text-sm"
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => {
                onRename(draft);
                setEditing(false);
              }}
            >
              <Check className="h-4 w-4 text-green-600" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => {
                setDraft(name);
                setEditing(false);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  title="Choose sub-team colour"
                  className="h-4 w-4 rounded-full shrink-0 border border-black/10 hover:ring-2 hover:ring-offset-1 hover:ring-muted-foreground/30"
                  style={{ backgroundColor: color.border }}
                />
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3" align="start">
                <div className="text-xs font-medium mb-2">Sub-team colour</div>
                <div className="grid grid-cols-6 gap-2">
                  {PASTEL_SWATCHES.map((sw) => (
                    <button
                      key={sw.id}
                      type="button"
                      title={sw.label}
                      onClick={() => onSetColor(sw.id)}
                      className={`h-6 w-6 rounded-full border transition ${
                        colorId === sw.id
                          ? "ring-2 ring-offset-1 ring-foreground/50"
                          : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: sw.bg, borderColor: sw.border }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-3 text-xs text-muted-foreground underline"
                  onClick={() => onSetColor("")}
                >
                  Reset to automatic
                </button>
              </PopoverContent>
            </Popover>
            <span
              className="rounded-md px-2 py-0.5 text-sm font-medium"
              style={{ backgroundColor: color.bg, color: color.text }}
            >
              {name}
            </span>
          </div>
        )}

        {!editing && (
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setEditing(true)}
              title="Rename"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive"
              onClick={onRemove}
              title="Delete sub-team"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {slots.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <div className="w-36 shrink-0 text-xs text-muted-foreground truncate" title={s.label}>
              {s.role || s.label}
            </div>
            <Select
              value={personFor(s.label) || NONE}
              onValueChange={(v) => onSetSlot(s.label, v === NONE ? "" : v)}
            >
              <SelectTrigger className="h-8 flex-1 text-sm">
                <SelectValue placeholder="Empty" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={NONE}>— Empty —</SelectItem>
                {candidates.map((v) => (
                  <SelectItem key={v.id} value={v.full_name}>
                    {v.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Select value={applyDate} onValueChange={setApplyDate}>
          <SelectTrigger className="h-8 flex-1 text-sm">
            <SelectValue placeholder="Apply to Sunday…" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {upcoming.map((d) => (
              <SelectItem key={d} value={d}>
                {format(parseISO(d), "EEE d MMM yyyy")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={!applyDate}
          onClick={() => {
            if (applyDate) onApply(applyDate);
          }}
        >
          <CalendarPlus className="h-4 w-4 mr-1" /> Apply
        </Button>
      </div>
    </div>
  );
}
