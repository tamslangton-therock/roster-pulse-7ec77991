import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRosterStore } from "@/lib/store";
import { areasOf } from "@/lib/roster-grid";
import { Settings2, Plus, Trash2, ChevronUp, ChevronDown, Layers } from "lucide-react";

/**
 * Manage the Live Roster column layout: add extra slots to a serving area,
 * add whole new serving teams, rename, reorder or remove — synced two-way
 * with the Live_Roster tab in Google Sheets.
 */
export function ManageColumnsDialog({ children }: { children?: React.ReactNode }) {
  const store = useRosterStore();
  const { slots, addSlotToArea, addServingArea, removeArea, renameArea, renameSlotRole, removeSlot, moveArea, moveSlot } = store;
  const [open, setOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newRoles, setNewRoles] = useState("");
  const [roleInputs, setRoleInputs] = useState<Record<string, string>>({});

  const areas = areasOf(slots);

  const handleAddTeam = () => {
    const name = newTeamName.trim();
    if (!name) return;
    const roles = newRoles
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean)
      .map((role) => ({ role, count: 1 }));
    addServingArea(name, roles.length ? roles : [{ role: "", count: 1 }]);
    setNewTeamName("");
    setNewRoles("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button variant="outline" size="sm">
            <Settings2 className="h-4 w-4 mr-2" />
            Columns &amp; Teams
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Columns &amp; Serving Teams</DialogTitle>
          <DialogDescription>
            These changes update the Live Roster here <em>and</em> the Live_Roster tab in
            Google Sheets — the header rows and clash formulas adjust automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {areas.map((area) => {
            const areaSlots = slots.filter((s) => s.area === area);
            const firstIdx = slots.findIndex((s) => s.area === area);
            const lastIdx = slots.length - 1 - [...slots].reverse().findIndex((s) => s.area === area);
            const distinctRoles = new Set(areaSlots.map((s) => s.role));
            return (
              <div key={area} className="rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 font-medium">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <span>{area}</span>
                    <span className="text-xs text-muted-foreground">
                      {areaSlots.length} slot{areaSlots.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={firstIdx === 0}
                      onClick={() => moveArea(area, -1)}
                      title="Move team up"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={lastIdx === slots.length - 1}
                      onClick={() => moveArea(area, 1)}
                      title="Move team down"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => {
                        if (confirm(`Remove "${area}" and all its slots from the roster?`)) {
                          removeArea(area);
                        }
                      }}
                      title="Remove team"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {areaSlots.map((slot) => (
                    <div key={slot.label} className="flex items-center gap-2">
                      <Input
                        defaultValue={slot.role}
                        placeholder="(no role name)"
                        className="h-8 flex-1"
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v !== slot.role) renameSlotRole(slot.label, v);
                        }}
                      />
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={slot.label === slots[0]?.label}
                          onClick={() => moveSlot(slot.label, -1)}
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={slot.label === slots[slots.length - 1]?.label}
                          onClick={() => moveSlot(slot.label, 1)}
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => removeSlot(slot.label)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add another slot to this area */}
                <div className="flex items-center gap-2 mt-2">
                  {distinctRoles.size > 1 ? (
                    <Select
                      onValueChange={(v) => {
                        addSlotToArea(area, v === "__blank" ? "" : v);
                      }}
                    >
                      <SelectTrigger className="h-8 flex-1">
                        <SelectValue placeholder="Add a slot for role…" />
                      </SelectTrigger>
                      <SelectContent>
                        {[...distinctRoles].map((r) => (
                          <SelectItem key={r || "__blank"} value={r || "__blank"}>
                            {r || "(no role name)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => addSlotToArea(area)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add another slot
                    </Button>
                  )}
                  {distinctRoles.size > 1 && (
                    <div className="flex flex-1 items-center gap-1">
                      <Input
                        placeholder="or new role name…"
                        className="h-8"
                        value={roleInputs[area] ?? ""}
                        onChange={(e) => setRoleInputs({ ...roleInputs, [area]: e.target.value })}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const v = (roleInputs[area] ?? "").trim();
                          if (!v) return;
                          addSlotToArea(area, v);
                          setRoleInputs({ ...roleInputs, [area]: "" });
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* New serving team */}
          <div className="rounded-lg border border-dashed p-3 space-y-2">
            <Label className="text-sm font-medium">Add a new serving team</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Team name, e.g. Security"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
              />
              <Input
                placeholder="Roles (comma separated) — optional, e.g. Milk, Cashier"
                value={newRoles}
                onChange={(e) => setNewRoles(e.target.value)}
              />
              <Button onClick={handleAddTeam} disabled={!newTeamName.trim()}>
                <Plus className="h-4 w-4 mr-1" />
                Add team
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Leave roles blank for a single general column. Teams are appended to the right
              of the roster; reorder them with the arrows above. "1, 2, 3" numbering is added
              automatically when a team has multiple slots of the same role.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
