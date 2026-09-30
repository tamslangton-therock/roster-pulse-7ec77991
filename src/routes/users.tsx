import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Shield, Trash2 } from "lucide-react";
import { useRoster } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import type { IndividualsAccess } from "@/lib/user-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

export const Route = createFileRoute("/users")({
  head: () => ({
    meta: [
      { title: "User Access — Roster Pulse" },
      {
        name: "description",
        content: "Create team-leader logins and switch their access to each area on or off.",
      },
      { property: "og:title", content: "User Access — Roster Pulse" },
      {
        property: "og:description",
        content: "Create team-leader logins and control what each person can see and edit.",
      },
    ],
  }),
  component: UserAccessPage,
});

function UserAccessPage() {
  const isMaster = useAuth((s) => s.master);
  const users = useRoster((s) => s.userAccess);
  const setUserAccess = useRoster((s) => s.setUserAccess);
  const slots = useRoster((s) => s.slots);

  const [addOpen, setAddOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplay, setNewDisplay] = useState("");

  const areas = useMemo(() => {
    const set = new Set<string>();
    for (const s of slots) set.add(s.area);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [slots]);

  if (!isMaster) {
    return (
      <div className="p-6">
        <div className="rounded-xl border bg-card p-8 text-center max-w-md mx-auto mt-16">
          <Shield className="h-8 w-8 mx-auto text-muted-foreground" />
          <h1 className="mt-3 text-lg font-semibold">User Access is admin-only</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with the admin access code to manage logins and permissions.
          </p>
        </div>
      </div>
    );
  }

  const updateUser = (username: string, updates: Partial<(typeof users)[number]>) => {
    setUserAccess(users.map((u) => (u.username === username ? { ...u, ...updates } : u)));
  };

  const removeUser = (username: string) => {
    setUserAccess(users.filter((u) => u.username !== username));
    toast.info(`Removed login for ${username}`);
  };

  const toggleArea = (list: string[], area: string): string[] =>
    list.includes(area) ? list.filter((a) => a !== area) : [...list, area];

  const handleAdd = () => {
    const username = newUsername.trim();
    if (!username || !newPassword.trim()) {
      toast.error("Name and password are both required.");
      return;
    }
    if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
      toast.error(`A login called "${username}" already exists.`);
      return;
    }
    setUserAccess([
      ...users,
      {
        username,
        password: newPassword.trim(),
        display_name: newDisplay.trim() || username,
        roster_view_areas: [],
        roster_edit_areas: [],
        can_view_health: false,
        team_edit_areas: [],
        individuals_access: "none",
      },
    ]);
    setAddOpen(false);
    setNewUsername("");
    setNewPassword("");
    setNewDisplay("");
    toast.success(`Login created for ${username} — set their switches below.`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">User Access</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {users.length} custom login{users.length === 1 ? "" : "s"} — saved to the{" "}
            <span className="font-medium">User_Access</span> tab in Google Sheets. Passwords are
            visible in that tab, so only share the sheet with people you trust.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New login
        </Button>
      </div>

      {users.length === 0 && (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          No custom logins yet. Create one for each team leader — they sign in with their name and
          the password you set, and only get the access you switch on below.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {users.map((u) => (
          <section key={u.username} className="rounded-xl border bg-card p-4 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 grid gap-2 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">Name (their login)</Label>
                  <Input
                    value={u.username}
                    onChange={(e) => updateUser(u.username, { username: e.target.value.trim() })}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Password</Label>
                  <Input
                    value={u.password}
                    onChange={(e) => updateUser(u.username, { password: e.target.value })}
                    className="h-8 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Display name</Label>
                  <Input
                    value={u.display_name}
                    onChange={(e) => updateUser(u.username, { display_name: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive"
                onClick={() => removeUser(u.username)}
                title="Delete login"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Live Roster edit scope */}
            <AreaScope
              title="Live Roster — can edit these areas"
              hint="Leave empty to give full roster editing. Tick only the areas they may change."
              allChecked={u.roster_edit_areas.length === 0}
              areas={areas}
              selected={u.roster_edit_areas}
              onToggle={(area) =>
                updateUser(u.username, { roster_edit_areas: toggleArea(u.roster_edit_areas, area) })
              }
              onSetAll={() => updateUser(u.username, { roster_edit_areas: [] })}
            />

            {/* Team Builder scope */}
            <AreaScope
              title="Team Builder — can edit sub-teams in"
              hint="Leave empty for no Team Builder editing."
              allChecked={false}
              areas={areas}
              selected={u.team_edit_areas}
              onToggle={(area) =>
                updateUser(u.username, { team_edit_areas: toggleArea(u.team_edit_areas, area) })
              }
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <Label className="text-sm" htmlFor={`health-${u.username}`}>
                  View Team Health
                </Label>
                <Switch
                  id={`health-${u.username}`}
                  checked={u.can_view_health}
                  onCheckedChange={(v) => updateUser(u.username, { can_view_health: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <Label className="text-sm" htmlFor={`ind-${u.username}`}>
                  Individuals access
                </Label>
                <Select
                  value={u.individuals_access || "none"}
                  onValueChange={(v) =>
                    updateUser(u.username, { individuals_access: v as IndividualsAccess })
                  }
                >
                  <SelectTrigger id={`ind-${u.username}`} className="h-8 w-[130px] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No access</SelectItem>
                    <SelectItem value="view">View only</SelectItem>
                    <SelectItem value="edit">View &amp; edit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>
        ))}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New team-leader login</DialogTitle>
            <DialogDescription>
              They sign in with this name and password. Set their access switches after creating.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name (login)</Label>
              <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="e.g. Oly" />
            </div>
            <div className="space-y-1">
              <Label>Password</Label>
              <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Set a password" />
            </div>
            <div className="space-y-1">
              <Label>Display name (optional)</Label>
              <Input value={newDisplay} onChange={(e) => setNewDisplay(e.target.value)} placeholder="Shown in the header" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd}>Create login</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AreaScope({
  title,
  hint,
  allChecked,
  areas,
  selected,
  onToggle,
  onSetAll,
}: {
  title: string;
  hint: string;
  allChecked: boolean;
  areas: string[];
  selected: string[];
  onToggle: (area: string) => void;
  onSetAll?: () => void;
}) {
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">{title}</div>
          <div className="text-[11px] text-muted-foreground">{hint}</div>
        </div>
        {onSetAll && !allChecked && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onSetAll}>
            All areas
          </Button>
        )}
        {onSetAll && allChecked && (
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Full access
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {areas.map((area) => {
          const on = selected.includes(area);
          return (
            <button
              key={area}
              type="button"
              onClick={() => onToggle(area)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                on
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {area}
            </button>
          );
        })}
        {areas.length === 0 && (
          <span className="text-xs text-muted-foreground">No serving areas defined yet.</span>
        )}
      </div>
    </div>
  );
}
