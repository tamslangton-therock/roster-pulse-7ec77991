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

  // New volunteer state
  const [newName, setNewName] = useState("");
  const [newMax, setNewMax] = useState(2);

  // Edit volunteer state
  const [editingVolunteer, setEditingVolunteer] = useState<Volunteer | null>(null);
  const [editName, setEditName] = useState("");
  const [editMax, setEditMax] = useState(2);

  const allAreas = useMemo(() => {
    const set = new Set<string>();
    volunteers.forEach((v: Volunteer) =>
      v.serving_areas.forEach((a) => set.add(a))
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

  const startEditing = (volunteer: Volunteer) => {
    setEditingVolunteer(volunteer);
    setEditName(volunteer.full_name);
    setEditMax(volunteer.max_serves_per_month);
  };

  const handleSaveEdit = () => {
    if (!editingVolunteer || !editName.trim()) return;
    updateVolunteer(editingVolunteer.id, {
      full_name: editName.trim(),
      max_serves_per_month: Number(editMax),
    });
    setEditingVolunteer(null);
    toast.success("Volunteer updated");
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
              <tr key={v.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium text-foreground">
                  {v.full_name}
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
                <td className="px-4 py-3">{v.max_serves_per_month} serves</td>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Volunteer</DialogTitle>
            <DialogDescription>
              Update the name and maximum monthly serving capacity for this volunteer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
                Full Name
              </label>
              <Input
                placeholder="Volunteer Name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
                Max Monthly Serves
              </label>
              <Input
                type="number"
                min={1}
                max={10}
                value={editMax}
                onChange={(e) => setEditMax(Number(e.target.value))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingVolunteer(null)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Volunteer Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Volunteer</DialogTitle>
            <DialogDescription>
              Create a new volunteer profile with serving areas and monthly cap.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
                Full Name
              </label>
              <Input
                placeholder="Full Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>

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
                  serving_areas: ["Welcome"],
                  max_serves_per_month: newMax,
                  active: true,
                });
                setNewName("");
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
