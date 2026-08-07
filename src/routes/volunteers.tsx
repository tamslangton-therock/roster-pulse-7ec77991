import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Edit2, Plus, Trash2, X } from "lucide-react";
import { useRoster } from "@/lib/store";
import type { Volunteer } from "@/lib/types";
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
import {
  VolunteerForm,
  emptyDraft,
  toDraft,
  type VolunteerDraft,
} from "@/components/volunteer-form";
import { toast } from "sonner";
import { ProfileHoverCard } from "@/components/profile-hover-card";


export const Route = createFileRoute("/volunteers")({
  head: () => ({
    meta: [
      { title: "Individuals — Roster Pulse" },
      {
        name: "description",
        content:
          "Master directory of every individual — serving areas, availability, context, challenges and prayer notes.",
      },
      { property: "og:title", content: "Individuals — Roster Pulse" },
      {
        property: "og:description",
        content: "Add, edit, and filter individual profiles, volunteer flags and serving rules.",
      },
    ],
  }),
  component: VolunteersPage,
});

function VolunteersPage() {
  const { volunteers, updateVolunteer, addVolunteer, removeVolunteer } =
    useRoster();

  const [search, setSearch] = useState("");
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [scope, setScope] = useState<"all" | "volunteers">("all");
  const [showAdd, setShowAdd] = useState(false);

  // New volunteer state
  const [newDraft, setNewDraft] = useState<VolunteerDraft>(emptyDraft);

  // Edit volunteer state
  const [editingVolunteer, setEditingVolunteer] = useState<Volunteer | null>(null);
  const [editDraft, setEditDraft] = useState<VolunteerDraft>(emptyDraft);

  const allAreas = useMemo(() => {
    const set = new Set<string>();
    volunteers.forEach((v: Volunteer) =>
      (v.serving_areas || []).forEach((a) => set.add(a))
    );
    return Array.from(set).sort();
  }, [volunteers]);

  const allNames = useMemo(
    () => volunteers.map((v: Volunteer) => v.full_name).filter(Boolean).sort(),
    [volunteers]
  );

  const filtered = useMemo(() => {
    return volunteers.filter((v: Volunteer) => {
      const matchesSearch = (v.full_name || "")
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesArea =
        selectedArea === "all" || (v.serving_areas && v.serving_areas.includes(selectedArea));
      const matchesScope = scope === "all" || v.is_volunteer !== false;
      return matchesSearch && matchesArea && matchesScope;
    });
  }, [volunteers, search, selectedArea, scope]);

  const volunteerCount = useMemo(
    () => volunteers.filter((v: Volunteer) => v.is_volunteer !== false).length,
    [volunteers]
  );

  const startEditing = (volunteer: Volunteer) => {
    setEditingVolunteer(volunteer);
    setEditDraft(toDraft(volunteer));
  };

  const handleSaveEdit = () => {
    if (!editingVolunteer || !editDraft.full_name.trim()) return;
    updateVolunteer(editingVolunteer.id, {
      ...editDraft,
      full_name: editDraft.full_name.trim(),
      max_serving_per_month: Number(editDraft.max_serving_per_month) || 0,
    });
    setEditingVolunteer(null);
    toast.success("Volunteer updated");
  };


  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Individuals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} shown · {volunteers.length} in directory ·{" "}
            {volunteerCount} active volunteers
          </p>
          <div className="mt-3 inline-flex rounded-md border bg-muted/40 p-0.5">
            {([
              { key: "all", label: "All individuals" },
              { key: "volunteers", label: "Active volunteers" },
            ] as const).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setScope(opt.key)}
                className={
                  "rounded-[5px] px-3 py-1.5 text-xs font-medium transition-colors " +
                  (scope === opt.key
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search volunteers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-[200px]"
          />

          <Select value={selectedArea} onValueChange={setSelectedArea}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filter area" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All areas</SelectItem>
              {allAreas.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add individual
          </Button>
        </div>
      </div>

      {/* Directory Table View */}
      <div className="border rounded-lg bg-card overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground font-medium border-b">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Serving Areas</th>
              <th className="px-4 py-3">Max / Month</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((v) => (
              <tr key={`${v.id}-${v.full_name}`} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium text-foreground">
                  <ProfileHoverCard name={v.full_name}>
                    <span className="cursor-default">{v.full_name}</span>
                  </ProfileHoverCard>
                  {v.is_volunteer === false && (
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      Non-serving
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(v.serving_areas || []).map((area) => (
                      <span
                        key={area}
                        className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
                      >
                        {area}
                        <button
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            updateVolunteer(v.id, {
                              serving_areas: v.serving_areas.filter(
                                (a) => a !== area
                              ),
                            })
                          }
                          title={`Remove ${area}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">{v.max_serving_per_month} serves</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEditing(v)}
                      className="h-8 gap-1.5 px-2.5"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        removeVolunteer(v.id);
                        toast.info(`Removed ${v.full_name}`);
                      }}
                      className="h-8 w-8 text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Volunteer Dialog */}
      <Dialog
        open={Boolean(editingVolunteer)}
        onOpenChange={(open) => {
          if (!open) setEditingVolunteer(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit {editingVolunteer?.full_name}</DialogTitle>
            <DialogDescription>
              Every field here maps to a column in the Volunteers tab of your
              Google Sheet.
            </DialogDescription>
          </DialogHeader>

          <VolunteerForm
            draft={editDraft}
            onChange={setEditDraft}
            allNames={allNames.filter((n) => n !== editingVolunteer?.full_name)}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingVolunteer(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Volunteer Dialog */}
      <Dialog
        open={showAdd}
        onOpenChange={(open) => {
          setShowAdd(open);
          if (open) setNewDraft(emptyDraft());
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Volunteer</DialogTitle>
            <DialogDescription>
              Create a full volunteer profile — it syncs straight to the sheet.
            </DialogDescription>
          </DialogHeader>

          <VolunteerForm
            draft={newDraft}
            onChange={setNewDraft}
            allNames={allNames}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!newDraft.full_name.trim()) {
                  toast.error("Name is required");
                  return;
                }
                addVolunteer({
                  ...newDraft,
                  full_name: newDraft.full_name.trim(),
                  max_serving_per_month:
                    Number(newDraft.max_serving_per_month) || 0,
                });
                setNewDraft(emptyDraft());
                setShowAdd(false);
                toast.success("Volunteer added");
              }}
            >
              Add Volunteer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
