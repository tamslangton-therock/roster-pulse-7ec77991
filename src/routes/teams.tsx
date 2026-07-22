import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Check, Edit2, Plus, Trash2, UserMinus, X } from "lucide-react";
import { useRoster } from "@/lib/store";
import type { Team } from "@/lib/types";
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

export const Route = createFileRoute("/teams")({
  head: () => ({
    meta: [
      { title: "Team Builder — Roster Pulse" },
      {
        name: "description",
        content:
          "Compose serving teams by area, assign volunteers, and push team changes to live roster dates.",
      },
      { property: "og:title", content: "Team Builder — Roster Pulse" },
      {
        property: "og:description",
        content:
          "Build and edit Welcome Team, Car Park Crew, Worship Band, Hosting, and more.",
      },
    ],
  }),
  component: TeamsPage,
});

function TeamsPage() {
  const { teams, volunteers, assignments, updateTeamMembers, addTeam, removeTeam } =
    useRoster();

  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newArea, setNewArea] = useState("Welcome");
  const [reallocPrompt, setReallocPrompt] = useState<{
    team: Team;
    dates: string[];
  } | null>(null);

  const areas = useMemo(() => {
    const s = new Set(teams.map((t) => t.serving_area));
    return Array.from(s).sort();
  }, [teams]);

  const shown = useMemo(
    () =>
      teams
        .filter((t) => selectedArea === "all" || t.serving_area === selectedArea)
        .sort((a, b) => a.team_name.localeCompare(b.team_name)),
    [teams, selectedArea],
  );

  const handleTeamUpdate = (team: Team, updatedFields: Partial<Team>) => {
    // Perform update on team
    const updatedMembers = updatedFields.member_names ?? team.member_names;
    
    // Mutate team properties locally in store context
    if (updatedFields.team_name !== undefined) {
      team.team_name = updatedFields.team_name;
    }
    if (updatedFields.serving_area !== undefined) {
      team.serving_area = updatedFields.serving_area;
    }

    updateTeamMembers(team.id, updatedMembers);

    const impactedDates = assignments
      .filter((a) => a.team_name === team.team_name && new Date(a.date) >= new Date())
      .map((a) => a.date);
    const unique = Array.from(new Set(impactedDates));

    if (unique.length > 0) {
      setReallocPrompt({ team, dates: unique });
    } else {
      toast.success(`${team.team_name} updated`);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team Builder</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {teams.length} teams across {areas.length} serving areas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedArea} onValueChange={setSelectedArea}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter area" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All areas</SelectItem>
              {areas.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" /> New team
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {shown.map((t) => (
          <TeamCard
            key={t.id}
            team={t}
            areas={areas}
            volunteers={volunteers}
            onUpdateTeam={(updatedFields) => handleTeamUpdate(t, updatedFields)}
            onRemove={() => {
              removeTeam(t.id);
              toast.info(`Removed ${t.team_name}`);
            }}
          />
        ))}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create team</DialogTitle>
            <DialogDescription>Group volunteers under a serving area.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              placeholder="Team name (e.g. Welcome Team 7)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />

            <Select value={newArea} onValueChange={setNewArea}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {areas.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!newName.trim()) return;
                addTeam(newName.trim(), newArea);
                setNewName("");
                setShowAdd(false);
                toast.success("Team created");
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reallocPrompt} onOpenChange={(o) => !o && setReallocPrompt(null)}>
        <DialogContent>
          {reallocPrompt && (
            <>
              <DialogHeader>
                <DialogTitle>Re-allocate live roster?</DialogTitle>
                <DialogDescription>
                  {reallocPrompt.team.team_name} composition changed. The following upcoming Sundays reference this team and may need review.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-1 max-h-64 overflow-auto">
                {reallocPrompt.dates.map((d) => (
                  <div key={d} className="rounded-md bg-muted px-3 py-2 text-sm">
                    {format(parseISO(d), "EEE d MMM yyyy")}
                  </div>
                ))}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setReallocPrompt(null)}>
                  Later
                </Button>
                <Button
                  onClick={() => {
                    toast.success("Marked for review on Live Roster");
                    setReallocPrompt(null);
                  }}
                >
                  Got it
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TeamCard({
  team,
  areas,
  volunteers,
  onUpdateTeam,
  onRemove,
}: {
  team: Team;
  areas: string[];
  volunteers: import("@/lib/types").Volunteer[];
  onUpdateTeam: (updatedFields: Partial<Team>) => void;
  onRemove: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(team.team_name);
  const [editArea, setEditArea] = useState(team.serving_area);
  const [addPick, setAddPick] = useState("");

  const areaVolunteers = volunteers
    .filter(
      (v) =>
        !team.member_names.some((m) => m.toLowerCase() === v.full_name.toLowerCase()) &&
        v.serving_areas.some(
          (a) => a.toLowerCase() === (isEditing ? editArea : team.serving_area).toLowerCase(),
        ),
    )
    .slice(0, 200);

  const handleSaveHeader = () => {
    if (!editName.trim()) return;
    onUpdateTeam({ team_name: editName.trim(), serving_area: editArea });
    setIsEditing(false);
  };

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        {isEditing ? (
          <div className="flex-1 space-y-2">
            <Select value={editArea} onValueChange={setEditArea}>
              <SelectTrigger className="h-7 text-xs uppercase tracking-wide">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {areas.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-8 font-semibold text-sm"
              placeholder="Team name"
            />
          </div>
        ) : (
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {team.serving_area}
            </div>
            <div className="font-semibold">{team.team_name}</div>
          </div>
        )}

        <div className="flex items-center gap-1">
          {isEditing ? (
            <>
              <Button variant="ghost" size="icon" onClick={handleSaveHeader} title="Save changes">
                <Check className="h-4 w-4 text-green-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditName(team.team_name);
                  setEditArea(team.serving_area);
                  setIsEditing(false);
                }}
                title="Cancel"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditing(true)}
                title="Edit team details"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onRemove} title="Delete team">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Member Tags */}
      <div className="mt-3 flex flex-wrap gap-1.5 min-h-[40px]">
        {team.member_names.length === 0 && (
          <span className="text-xs text-muted-foreground italic">No members yet</span>
        )}
        {team.member_names.map((m) => (
          <span
            key={m}
            className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-xs"
          >
            {m}
            <button
              className="text-muted-foreground hover:text-foreground"
              onClick={() =>
                onUpdateTeam({
                  member_names: team.member_names.filter((x) => x !== m),
                })
              }
              title="Remove"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      {/* Add Volunteer Selector */}
      <div className="mt-3 flex items-center gap-2">
        <Select value={addPick} onValueChange={setAddPick}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Add volunteer…" />
          </SelectTrigger>
          <SelectContent>
            {areaVolunteers.map((v) => (
              <SelectItem key={v.id} value={v.full_name}>
                {v.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={!addPick}
          onClick={() => {
            if (!addPick) return;
            onUpdateTeam({ member_names: [...team.member_names, addPick] });
            setAddPick("");
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

// Silence unused warnings
void UserMinus;
