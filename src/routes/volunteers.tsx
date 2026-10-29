import { createFileRoute } from "@tanstack/react-router";
import { useLiveUser } from "@/lib/use-live-user";
import { useMemo, useState } from "react";
import { Edit2, Plus, Trash2, X, Target, Send } from "lucide-react";
import { portalWhatsappUrl, waDigits } from "@/lib/portal-link";
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
import { useAuth } from "@/lib/auth";
import { areaInScope, canEditIndividuals, canViewIndividuals, individualsViewAreas, inIndividualsScope } from "@/lib/user-access";
import { AccessNotice } from "@/components/access-notice";
import { findIndividual } from "@/lib/person-link";
import { InterestPathwayDialog } from "@/components/interest-pathway-dialog";


export const Route = createFileRoute("/volunteers")({
  head: () => ({
    meta: [
      { title: "Family — The Rock Church" },
      {
        name: "description",
        content:
          "Family directory of every person — serving areas, availability, context, challenges and prayer notes.",
      },
      { property: "og:title", content: "Family — The Rock Church" },
      {
        property: "og:description",
        content: "Add, edit, and filter family profiles, volunteer flags and serving rules.",
      },
    ],
  }),
  component: VolunteersPage,
});

function VolunteersPage() {
  const { volunteers, lifeGroups, updateVolunteer, addVolunteer, removeVolunteer } =
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
  const [pathwaysFor, setPathwaysFor] = useState<Volunteer | null>(null);
  const [linkFor, setLinkFor] = useState<Volunteer | null>(null);
  const [pinFor, setPinFor] = useState<Volunteer | null>(null);
  const [pinDraft, setPinDraft] = useState("");
  const [linkPhone, setLinkPhone] = useState("");

  const sendPortalLink = (v: Volunteer) => {
    if (v.phone && v.phone.replace(/\D/g, "").length >= 9) {
      window.open(portalWhatsappUrl(v.full_name, v.phone, v.id), "_blank");
    } else {
      setLinkPhone("");
      setLinkFor(v);
    }
  };

  const savePhoneAndSend = () => {
    if (!linkFor) return;
    const phone = linkPhone.trim();
    if (phone.replace(/\D/g, "").length < 9) {
      toast.error("Please enter a valid cell number");
      return;
    }
    updateVolunteer(linkFor.id, { phone });
    window.open(portalWhatsappUrl(linkFor.full_name, phone, linkFor.id), "_blank");
    toast.success(`Saved number for ${linkFor.full_name}`);
    setLinkFor(null);
  };

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

  const isMaster = useAuth((s) => s.master);
  const authUser = useLiveUser();
  const scopeAreas = individualsViewAreas(isMaster, authUser);

  const filtered = useMemo(() => {
    return volunteers.filter((v: Volunteer) => {
      const matchesSearch = (v.full_name || "")
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesArea =
        selectedArea === "all" || (v.serving_areas && v.serving_areas.includes(selectedArea));
      const matchesScope = scope === "all" || v.is_volunteer !== false;
      const inScope = inIndividualsScope(isMaster, authUser, v.serving_areas);
      return matchesSearch && matchesArea && matchesScope && inScope;
    });
  }, [volunteers, search, selectedArea, scope, isMaster, authUser]);

  const volunteerCount = useMemo(
    () =>
      volunteers.filter(
        (v: Volunteer) =>
          v.is_volunteer !== false && inIndividualsScope(isMaster, authUser, v.serving_areas)
      ).length,
    [volunteers, isMaster, authUser]
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


  const canEditPeople = canEditIndividuals(isMaster, authUser);
  if (!canViewIndividuals(isMaster, authUser)) {
    return <AccessNotice title="Family is not switched on for your login" />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Family</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} shown · {volunteers.length} in directory ·{" "}
            {volunteerCount} active volunteers
            {scopeAreas.length > 0 && (
              <> · showing only: {scopeAreas.join(", ")}</>
            )}
          </p>
          <div className="mt-3 inline-flex rounded-md border bg-muted/40 p-0.5">
            {([
              { key: "all", label: "All family" },
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
              {allAreas
                .filter((a) => scopeAreas.length === 0 || areaInScope(scopeAreas, a))
                .map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {canEditPeople && (
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add family member
            </Button>
          )}
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
                  {(() => {
                    const key = v.full_name.trim().toLowerCase();
                    const groups = lifeGroups.filter((g) =>
                      g.MembersList.some((m) => m.trim().toLowerCase() === key) ||
                      g.Leaders.split(/\s*[|,;]\s*/).some((l) => l.trim().toLowerCase() === key),
                    );
                    return (
                      <div className="mt-1 flex flex-wrap gap-1 text-[11px] font-normal text-muted-foreground">
                        <span>Life group:</span>
                        {groups.length === 0 ? (
                          <span>—</span>
                        ) : (
                          groups.map((g) => (
                            <span key={g.GroupID} className="rounded-full border px-1.5">
                              {g.GroupName || "Untitled"}
                            </span>
                          ))
                        )}
                      </div>
                    );
                  })()}
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
                        {canEditPeople && (
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
                        )}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">{v.max_serving_per_month} serves</td>
                <td className="px-4 py-3 text-right">
                  {canEditPeople ? (
                    <div className="flex items-center justify-end gap-1">
                      {v.is_volunteer !== false && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => sendPortalLink(v)}
                          className="h-8 gap-1.5 px-2.5"
                          title="Send their personal link on WhatsApp"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>Link</span>
                        </Button>
                      )}
                      {isMaster && v.is_volunteer !== false && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setPinFor(v); setPinDraft(v.pin ?? ""); }}
                          className="h-8 px-2.5"
                          title="View or reset their PIN"
                        >
                          PIN
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPathwaysFor(v)}
                        className="h-8 gap-1.5 px-2.5"
                        title="Add to Baptism, Alpha, etc."
                      >
                        <Target className="h-3.5 w-3.5" />
                        <span>Interests</span>
                      </Button>
                      <Button
                        variant="ghost"
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
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(pinFor)} onOpenChange={(o) => !o && setPinFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>PIN for {pinFor?.full_name}</DialogTitle>
            <DialogDescription>
              {pinFor?.pin ? `Current PIN: ${pinFor.pin}` : "Not set yet — they'll create one when they first open their schedule."}
            </DialogDescription>
          </DialogHeader>
          <Input
            inputMode="numeric"
            maxLength={4}
            placeholder="New 4-digit PIN"
            value={pinDraft}
            onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              disabled={!pinFor?.pin || !pinFor?.phone}
              onClick={() => {
                if (!pinFor?.pin || !pinFor.phone) return;
                const msg = `Hi ${pinFor.full_name.split(" ")[0]}, your 4-digit PIN for The Rock Church serving schedule is: ${pinFor.pin}`;
                window.open(`https://wa.me/${waDigits(pinFor.phone)}?text=${encodeURIComponent(msg)}`, "_blank");
              }}
            >
              WhatsApp PIN
            </Button>
            <Button
              onClick={() => {
                if (!pinFor || !/^\d{4}$/.test(pinDraft)) return toast.error("PIN must be 4 digits");
                updateVolunteer(pinFor.id, { pin: pinDraft });
                setPinFor({ ...pinFor, pin: pinDraft });
                toast.success("PIN saved");
              }}
            >
              Save PIN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(linkFor)} onOpenChange={(o) => !o && setLinkFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add cell number for {linkFor?.full_name}</DialogTitle>
            <DialogDescription>
              Enter their number to save it to their profile and send their personal link.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            inputMode="tel"
            placeholder="e.g. 082 123 4567"
            value={linkPhone}
            onChange={(e) => setLinkPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && savePhoneAndSend()}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLinkFor(null)}>Cancel</Button>
            <Button onClick={savePhoneAndSend}>Save & open WhatsApp</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <DialogTitle>Add family member</DialogTitle>
            <DialogDescription>
              Create a full profile — it syncs straight to the sheet.
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
                const existing = findIndividual(volunteers, newDraft.full_name);
                if (existing) {
                  toast.error(`${existing.full_name} already has a profile — edit that one instead so there's no duplicate.`);
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
              Add family member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InterestPathwayDialog
        volunteer={pathwaysFor}
        open={Boolean(pathwaysFor)}
        onOpenChange={(v) => !v && setPathwaysFor(null)}
      />
    </div>
  );
}
