import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Check, Edit2, Plus, Trash2, X } from "lucide-react";
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
import { toast } from "sonner";

export const Route = createFileRoute("/volunteers")({
  head: () => ({
    meta: [
      { title: "Volunteers — Roster Pulse" },
      {
        name: "description",
        content:
          "Manage volunteer database, update serving areas, max serving frequency, and availability status.",
      },
      { property: "og:title", content: "Volunteers — Roster Pulse" },
      {
        property: "og:description",
        content: "Add, edit, and filter volunteer profiles and serving rules.",
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
  const [showAdd, setShowAdd] = useState(false);

  const [newName, setNewName] = useState("");
  const [newAreas] = useState<string[]>(["Welcome"]);
  const [newMax, setNewMax] = useState(2);

  // Track row being edited in Table view
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [rowEditName, setRowEditName] = useState("");
  const [rowEditMax, setRowEditMax] = useState(2);

  const allAreas = useMemo(() => {
    const set = new Set<string>();
    volunteers.forEach((v: Volunteer) =>
      v.serving_areas.forEach((a) => set.add(a)),
    );
    return Array.from(set).sort();
  }, [volunteers]);

  const filtered = useMemo(() => {
    return volunteers.filter((v: Volunteer) => {
      const matchesSearch = v.full_name
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesArea =
        selectedArea === "all" || v.serving_areas.includes(selectedArea);
      return matchesSearch && matchesArea;
    });
  }, [volunteers, search, selectedArea]);

  const handleUpdate = (id: string, updates: Partial<Volunteer>) => {
    updateVolunteer(id, updates);
    toast.success("Volunteer updated");
  };

  const handleStartRowEdit = (v: Volunteer) => {
    setEditingRowId(v.id);
    setRowEditName(v.full_name);
    setRowEditMax(v.max_serves_per_month);
  };

  const handleSaveRowEdit = (id: string) => {
    if (!rowEditName.trim()) return;
    handleUpdate(id, {
      full_name: rowEditName.trim(),
      max_serves_per_month: Number(rowEditMax),
    });
    setEditingRowId(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Volunteers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {volunteers.length} volunteers in directory
          </p>
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
            <Plus className="h-4 w-4 mr-1" /> Add volunteer
          </Button>
        </div>
      </div>

      {/* Table / List View */}
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
            {filtered.map((v) => {
              const isEditing = editingRowId === v.id;

              return (
                <tr key={v.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    {isEditing ? (
                      <Input
                        value={rowEditName}
                        onChange={(e) => setRowEditName(e.target.value)}
                        className="h-8 max-w-[200px]"
                      />
                    ) : (
                      v.full_name
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {v.serving_areas.map((area) => (
                        <span
                          key={area}
                          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
                        >
                          {area}
                          <button
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() =>
                              handleUpdate(v.id, {
                                serving_areas: v.serving_areas.filter(
                                  (a) => a !== area,
                                ),
                              })
                            }
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <Input
                        type="number"
                        value={rowEditMax}
                        onChange={(e) => setRowEditMax(Number(e.target.value))}
                        className="h-8 w-20"
                        min={1}
                      />
                    ) : (
                      `${v.max_serves_per_month} serves`
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isEditing ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSaveRowEdit(v.id)}
                            className="h-8 w-8 text-green-600"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingRowId(null)}
                            className="h-8 w-8"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleStartRowEdit(v)}
                            title="Edit volunteer"
                            className="h-8 w-8 bg-background border-input"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
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
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Grid Card View */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
        {filtered.map((v: Volunteer) => (
          <VolunteerCard
            key={v.id}
            volunteer={v}
            availableAreas={allAreas}
            onUpdate={(updates) => handleUpdate(v.id, updates)}
            onRemove={() => {
              removeVolunteer(v.id);
              toast.info(`Removed ${v.full_name}`);
            }}
          />
        ))}
      </div>

      {/* Add Modal */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Volunteer</DialogTitle>
            <DialogDescription>
              Create a new volunteer profile with serving areas and monthly cap.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              placeholder="Full Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />

            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
                Max Monthly Serves
              </label>
              <Input
                type="number"
                min={1}
                max={10}
                value={newMax}
                onChange={(e) => setNewMax(Number(e.target.value))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!newName.trim()) return;
                addVolunteer({
                  full_name: newName.trim(),
                  serving_areas: newAreas,
                  max_serves_per_month: newMax,
                  active: true,
                });
                setNewName("");
                setShowAdd(false);
                toast.success("Volunteer added");
              }}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VolunteerCard({
  volunteer,
  availableAreas,
  onUpdate,
  onRemove,
}: {
  volunteer: Volunteer;
  availableAreas: string[];
  onUpdate: (updates: Partial<Volunteer>) => void;
  onRemove: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(volunteer.full_name);
  const [editMax, setEditMax] = useState(volunteer.max_serves_per_month);
  const [newAreaPick, setNewAreaPick] = useState("");

  useEffect(() => {
    setEditName(volunteer.full_name);
    setEditMax(volunteer.max_serves_per_month);
  }, [volunteer.full_name, volunteer.max_serves_per_month]);

  const handleSave = () => {
    if (!editName.trim()) return;
    onUpdate({
      full_name: editName.trim(),
      max_serves_per_month: Number(editMax),
    });
    setIsEditing(false);
  };

  const unselectedAreas = availableAreas.filter(
    (a) => !volunteer.serving_areas.includes(a),
  );

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-2">
          {isEditing ? (
            <div className="flex-1 space-y-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-8 font-semibold text-sm"
                placeholder="Full Name"
              />
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Max/mo:</span>
                <Input
                  type="number"
                  value={editMax}
                  onChange={(e) => setEditMax(Number(e.target.value))}
                  className="h-7 w-20 text-xs"
                  min={1}
                />
              </div>
            </div>
          ) : (
            <div>
              <div className="font-semibold text-base">
                {volunteer.full_name}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Max {volunteer.max_serves_per_month} serves / month
              </div>
            </div>
          )}

          <div className="flex items-center gap-1">
            {isEditing ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSave}
                  title="Save changes"
                  className="h-8 w-8"
                >
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditName(volunteer.full_name);
                    setEditMax(volunteer.max_serves_per_month);
                    setIsEditing(false);
                  }}
                  title="Cancel"
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsEditing(true)}
                  title="Edit volunteer details"
                  className="h-8 w-8 bg-background border-input shadow-xs"
                >
                  <Edit2 className="h-3.5 w-3.5 text-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onRemove}
                  title="Remove volunteer"
                  className="h-8 w-8 text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {volunteer.serving_areas.map((area) => (
            <span
              key={area}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium"
            >
              {area}
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={() =>
                  onUpdate({
                    serving_areas: volunteer.serving_areas.filter(
                      (a) => a !== area,
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

        {unselectedAreas.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <Select value={newAreaPick} onValueChange={setNewAreaPick}>
              <SelectTrigger className="flex-1 h-8 text-xs">
                <SelectValue placeholder="Add serving area…" />
              </SelectTrigger>
              <SelectContent>
                {unselectedAreas.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-8 text-xs px-2.5"
              disabled={!newAreaPick}
              onClick={() => {
                if (!newAreaPick) return;
                onUpdate({
                  serving_areas: [...volunteer.serving_areas, newAreaPick],
                });
                setNewAreaPick("");
              }}
            >
              Add
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
