import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarPlus, Palette, Plus, Trash2, X } from "lucide-react";
import { useRoster } from "@/lib/store";
import { areasOf } from "@/lib/roster-grid";
import { builderAreas, builderTeamName, sourceAreas } from "@/lib/team-builder-groups";
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
import { ManageColumnsDialog } from "@/components/manage-columns-dialog";
import { resolveSubTeamColor, PASTEL_SWATCHES } from "@/lib/person-colors";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/lib/auth";
import { canEditTeamsArea } from "@/lib/user-access";
import { AccessNotice } from "@/components/access-notice";
import { SaveBar } from "@/components/save-bar";

export const Route = createFileRoute("/teams")({
  head: () => ({
    meta: [
      { title: "Team Builder — The Rock Church" },
      {
        name: "description",
        content:
          "Build ideal sub-teams inside each serving area and push them onto any Sunday of the live roster.",
      },
      { property: "og:title", content: "Team Builder — The Rock Church" },
      {
        property: "og:description",
        content:
          "Group volunteers into repeatable sub-teams per serving area, synced live with Google Sheets.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
    slots,
    addSubTeam,
    removeSubTeam,
    renameSubTeam,
    setSubTeamColor,

    setSubTeamSlot,
    applySubTeamToDate,
  } = useRoster();

  const isMaster = useAuth((s) => s.master);
  const authUser = useAuth((s) => s.user);
  const canEditThisArea = (area: string) => canEditTeamsArea(isMaster, authUser, area);

  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [newFor, setNewFor] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const allAreas = useMemo(() => builderAreas(areasOf(slots)), [slots]);
  const areas = useMemo(
    () => (selectedArea === "all" ? allAreas : [selectedArea]),
    [selectedArea, allAreas],
  );

  const byArea = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of subTeams) {
      const area = allAreas.find((a) => sourceAreas(a).includes(r.serving_area)) ?? r.serving_area;
      const list = map.get(area) ?? [];
      const name = builderTeamName(r.serving_area, r.sub_team_name);
      if (!list.includes(name)) list.push(name);
      map.set(area, list);
    }
    for (const [, list] of map) list.sort((a, b) => a.localeCompare(b));
    return map;
  }, [subTeams, allAreas]);

  const totalSubTeams = useMemo(
    () => Array.from(byArea.values()).reduce((n, l) => n + l.length, 0),
    [byArea],
  );

  if (!isMaster && (authUser?.teamEditAreas ?? []).length === 0) {
    return (
      <AccessNotice title="Team Builder is not switched on for your login" />
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team Builder</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalSubTeams} sub-teams across {allAreas.length} serving areas — saved to
            the <span className="font-medium">Sub_Teams</span> tab in Google Sheets.
            {!isMaster && authUser && (
              <>
                {" "}You can edit: <span className="font-medium">{authUser.teamEditAreas.join(", ")}</span>.
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <SaveBar inline label="Save teams" />
          {isMaster && <ManageColumnsDialog />}
          <Select value={selectedArea} onValueChange={setSelectedArea}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter area" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All serving areas</SelectItem>
              {allAreas.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-6">
        {areas.map((area) => {
          const members = sourceAreas(area);
          const areaSlots = slots.filter((s) => members.includes(s.area));
          const names = byArea.get(area) ?? [];
          const editable = members.every(canEditThisArea);
          const storedName = (member: string, name: string) =>
            subTeams.find((r) => r.serving_area === member && builderTeamName(member, r.sub_team_name) === name)?.sub_team_name ?? name;
          return (
            <section key={area} className="rounded-lg border bg-card overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wide">{area}</h2>
                  <span className="text-xs text-muted-foreground">
                    {names.length} team{names.length === 1 ? "" : "s"}
                  </span>
                </div>
                {editable && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    onClick={() => {
                      let n = names.length + 1;
                      while (names.includes(`Team ${n}`)) n++;
                      members.forEach((member) => addSubTeam(member, `Team ${n}`));
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add team
                  </Button>
                )}
              </div>
              {names.length === 0 ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">No teams yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-muted/40 text-xs text-muted-foreground">
                        <th className="w-8 border-r px-2 py-1.5 text-center font-medium">#</th>
                        <th className="min-w-[120px] border-r px-2 py-1.5 text-left font-medium">Team</th>
                        {areaSlots.map((s) => (
                          <th key={s.label} className="min-w-[150px] border-r px-2 py-1.5 text-left font-medium">
                            {s.role || s.label}
                          </th>
                        ))}
                        <th className="w-24 px-2 py-1.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {names.map((name, i) => (
                        <SubTeamRowView
                          key={`${area}::${name}`}
                          index={i + 1}
                          area={area}
                          name={name}
                          slots={areaSlots}
                          rows={subTeams.filter(
                            (r) => members.includes(r.serving_area) && builderTeamName(r.serving_area, r.sub_team_name) === name,
                          )}
                          volunteers={volunteers}
                          dates={dates}
                          colorId={
                            subTeams.find(
                              (r) => members.includes(r.serving_area) && builderTeamName(r.serving_area, r.sub_team_name) === name && r.color,
                            )?.color
                          }
                          onSetColor={(id) => members.forEach((member) => setSubTeamColor(member, storedName(member, name), id))}
                          onSetSlot={(label, person) => {
                            const slot = areaSlots.find((s) => s.label === label);
                            if (slot) setSubTeamSlot(slot.area, storedName(slot.area, name), label, person);
                          }}
                          onRename={(next) => {
                            if (!next.trim() || next === name) return;
                            if (names.includes(next.trim())) {
                              toast.error("A team with that name already exists");
                              return;
                            }
                            members.forEach((member) => renameSubTeam(member, storedName(member, name), next.trim()));
                          }}
                          onRemove={() => {
                            if (!confirm(`Delete ${name} from ${area}?`)) return;
                            members.forEach((member) => removeSubTeam(member, storedName(member, name)));
                            toast.info(`Removed ${name}`);
                          }}
                          onApply={(date) => {
                            const n = members.reduce((count, member) => count + applySubTeamToDate(member, storedName(member, name), date), 0);
                            toast.success(
                              `${name} applied to ${format(parseISO(date), "d MMM yyyy")}`,
                              { description: `${n} slot${n === 1 ? "" : "s"} filled — override any slot on the Live Roster.` },
                            );
                          }}
                          readOnly={!editable}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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

function SubTeamRowView({
  index,
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
  colorId,
  onSetColor,
  readOnly = false,
}: {
  index: number;
  area: string;
  name: string;
  slots: Array<{ label: string; role: string; area: string }>;
  rows: Array<{ slot_label: string; person_name: string }>;
  volunteers: import("@/lib/types").Volunteer[];
  dates: string[];
  onSetSlot: (label: string, person: string) => void;
  onRename: (next: string) => void;
  onRemove: () => void;
  onApply: (date: string) => void;
  colorId?: string;
  onSetColor: (id: string) => void;
  readOnly?: boolean;
}) {
  const color = resolveSubTeamColor(area, name, colorId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  const personFor = (label: string) =>
    rows.find((r) => r.slot_label === label)?.person_name ?? "";

  const candidatesFor = (slotArea: string) => {
    const isIn = (v: import("@/lib/types").Volunteer) =>
      v.serving_areas.some((a) => a.toLowerCase() === slotArea.toLowerCase());
    return [...volunteers].sort(
      (a, b) => Number(isIn(b)) - Number(isIn(a)) || a.full_name.localeCompare(b.full_name),
    ).map((v) => ({ name: v.full_name, inArea: isIn(v) }));
  };

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return dates.filter((d) => d >= today).slice(0, 30);
  }, [dates]);

  const commit = () => {
    onRename(draft);
    setEditing(false);
  };

  return (
    <tr className="border-t" style={{ backgroundColor: color.bg, color: color.text }}>
      <td className="border-r px-2 py-1 text-center font-semibold tabular-nums">{index}</td>
      <td className="border-r px-2 py-1">
        {editing ? (
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setDraft(name);
                setEditing(false);
              }
            }}
            className="h-7 bg-background text-sm"
          />
        ) : (
          <button
            type="button"
            disabled={readOnly}
            onClick={() => {
              setDraft(name);
              setEditing(true);
            }}
            className="w-full truncate text-left font-medium disabled:cursor-default"
            title={readOnly ? name : "Tap to rename"}
          >
            {name}
          </button>
        )}
      </td>
      {slots.map((s) => (
        <td key={s.label} className="border-r p-0">
          <PersonCell
            value={personFor(s.label)}
            candidates={candidatesFor(s.area)}
            readOnly={readOnly}
            onChange={(v) => onSetSlot(s.label, v)}
          />
        </td>
      ))}
      <td className="px-1 py-1">
        {!readOnly && (
          <div className="flex items-center justify-end gap-0.5">
            <Popover>
              <PopoverTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7" title="Apply to a Sunday">
                  <CalendarPlus className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-1" align="end">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Apply {name} to…</div>
                <div className="max-h-64 overflow-y-auto">
                  {upcoming.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => onApply(d)}
                      className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                    >
                      {format(parseISO(d), "EEE d MMM yyyy")}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7" title="Row colour">
                  <Palette className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3" align="end">
                <div className="grid grid-cols-6 gap-2">
                  {PASTEL_SWATCHES.map((sw) => (
                    <button
                      key={sw.id}
                      type="button"
                      onClick={() => onSetColor(sw.id)}
                      className={`h-6 w-6 rounded-full border-2 ${colorId === sw.id ? "ring-2 ring-offset-1 ring-foreground/40" : ""}`}
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
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onRemove} title="Delete team">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

/** Spreadsheet-style cell: tap to search and pick a person. Options render only while open. */
function PersonCell({
  value,
  candidates,
  readOnly,
  onChange,
}: {
  value: string;
  candidates: Array<{ name: string; inArea: boolean }>;
  readOnly: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  if (readOnly) {
    return <div className="min-h-8 px-2 py-1.5 truncate">{value}</div>;
  }
  const list = open
    ? candidates.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 60)
    : [];
  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setQ("");
  };
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="block min-h-8 w-full truncate px-2 py-1.5 text-left hover:bg-background/60 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/50"
        >
          {value || <span className="opacity-0">—</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-1" align="start">
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && list[0]) pick(list[0].name);
          }}
          placeholder="Search name…"
          className="h-8 text-sm"
        />
        <div className="mt-1 max-h-64 overflow-y-auto">
          {value && (
            <button
              type="button"
              onClick={() => pick("")}
              className="flex w-full items-center gap-1 rounded px-2 py-1.5 text-left text-sm text-destructive hover:bg-accent"
            >
              <X className="h-3.5 w-3.5" /> Clear cell
            </button>
          )}
          {list.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => pick(c.name)}
              className={`w-full truncate rounded px-2 py-1.5 text-left text-sm hover:bg-accent ${c.inArea ? "" : "text-muted-foreground"}`}
            >
              {c.name}
            </button>
          ))}
          {list.length === 0 && (
            <div className="px-2 py-2 text-xs text-muted-foreground">No matches</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
