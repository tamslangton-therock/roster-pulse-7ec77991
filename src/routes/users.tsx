import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Shield, SlidersHorizontal, Trash2 } from "lucide-react";
import { useRoster } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import type { IndividualsAccess } from "@/lib/user-access";
import {
  DEFAULT_HEALTH_SETTINGS,
  DEFAULT_HEALTH_LABELS,
  LABEL_STATUSES,
  MODE_OPTIONS,
  statusMetaWith,
  type HealthLabels,
  type HealthMode,
  type HealthSettings,
} from "@/lib/health-settings";
import type { FatigueStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
        can_view_roster: true,
        can_view_life_groups: false,
        health_view_areas: [],
        individuals_view_areas: [],
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

      <Tabs defaultValue="logins">
        <TabsList>
          <TabsTrigger value="logins">Leader logins</TabsTrigger>
          <TabsTrigger value="health" className="gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Health rules &amp; labels
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logins" className="space-y-6 mt-4">
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

            {/* Team Health view scope */}
            <AreaScope
              title="Team Health — can view these areas"
              hint="Leave empty to show all areas on Team Health. Tick only the areas they may see."
              allChecked={u.health_view_areas.length === 0}
              areas={areas}
              selected={u.health_view_areas}
              onToggle={(area) =>
                updateUser(u.username, { health_view_areas: toggleArea(u.health_view_areas, area) })
              }
              onSetAll={() => updateUser(u.username, { health_view_areas: [] })}
            />

            {/* Individuals view scope */}
            <AreaScope
              title="Individuals — can view these areas"
              hint="Leave empty to show everyone on the Individuals tab. Tick only the areas whose people they may see."
              allChecked={u.individuals_view_areas.length === 0}
              areas={areas}
              selected={u.individuals_view_areas}
              onToggle={(area) =>
                updateUser(u.username, {
                  individuals_view_areas: toggleArea(u.individuals_view_areas, area),
                })
              }
              onSetAll={() => updateUser(u.username, { individuals_view_areas: [] })}
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
                <Label className="text-sm" htmlFor={`roster-${u.username}`}>
                  View Live Roster
                </Label>
                <Switch
                  id={`roster-${u.username}`}
                  checked={u.can_view_roster !== false}
                  onCheckedChange={(v) => updateUser(u.username, { can_view_roster: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <Label className="text-sm" htmlFor={`lg-${u.username}`}>
                  Life Groups access
                </Label>
                <Switch
                  id={`lg-${u.username}`}
                  checked={u.can_view_life_groups === true}
                  onCheckedChange={(v) => updateUser(u.username, { can_view_life_groups: v })}
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

        </TabsContent>

        <TabsContent value="health" className="mt-4">
          <HealthRulesEditor />
        </TabsContent>
      </Tabs>

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

const TONE_CLASSES: Record<string, string> = {
  green: "bg-status-green text-status-green-foreground",
  yellow: "bg-status-yellow text-status-yellow-foreground",
  amber: "bg-status-amber text-status-amber-foreground",
  red: "bg-status-red text-status-red-foreground",
  blue: "bg-status-blue text-status-blue-foreground",
  slate: "bg-status-slate text-status-slate-foreground",
};

const DEFAULT_TITLES: Record<string, string> = {
  healthy: "Healthy",
  could_do_more: "Could do more",
  no_rest: "No rest weeks",
  burnout: "Burnout risk",
  paused: "Paused",
  inactive: "Inactive",
};

function HealthNumberField({
  label,
  value,
  onChange,
  min = 0,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(Math.max(min, parseInt(e.target.value) || 0))}
      />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function HealthRulesEditor() {
  const settings = useRoster((s) => s.healthSettings);
  const labels = useRoster((s) => s.healthLabels);
  const setHealthSettings = useRoster((s) => s.setHealthSettings);
  const resetHealthSettings = useRoster((s) => s.resetHealthSettings);

  const [draftSettings, setDraftSettings] = useState<HealthSettings>(settings);
  const [draftLabels, setDraftLabels] = useState<HealthLabels>(labels);

  // Follow the sheet-backed store if it reloads (e.g. after hydration).
  useEffect(() => setDraftSettings(settings), [settings]);
  useEffect(() => setDraftLabels(labels), [labels]);

  const dirty =
    JSON.stringify(draftSettings) !== JSON.stringify(settings) ||
    JSON.stringify(draftLabels) !== JSON.stringify(labels);

  const patchS = (p: Partial<HealthSettings>) => setDraftSettings((s) => ({ ...s, ...p }));
  const patchLabel = (key: (typeof LABEL_STATUSES)[number], field: "label" | "emoji", value: string) =>
    setDraftLabels((l) => ({ ...l, [key]: { ...l[key], [field]: value } }));

  const save = () => {
    setHealthSettings(draftSettings, draftLabels);
    toast.success("Health rules saved — synced to the Health_Config tab in Google Sheets.");
  };

  const resetDefaults = () => {
    setDraftSettings(DEFAULT_HEALTH_SETTINGS);
    setDraftLabels(DEFAULT_HEALTH_LABELS);
    resetHealthSettings();
    toast.info("Health rules reset to the built-in defaults.");
  };

  const countModes =
    draftSettings.mode !== "consecutive" && draftSettings.mode !== "preference";

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold">Team Health — rules &amp; category names</h2>
        <p className="text-sm text-muted-foreground mt-1">
          These master settings apply to everyone — every Team Health page, badge and history
          drawer uses these names and rules. Saved to the{" "}
          <span className="font-medium">Health_Config</span> tab in Google Sheets.
        </p>
      </div>

      {/* Status categories */}
      <div className="space-y-2">
        <div className="text-sm font-medium">Category names &amp; emojis</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {LABEL_STATUSES.map((key) => {
            const meta = statusMetaWith(draftLabels, key as FatigueStatus);
            return (
              <div key={key} className="rounded-lg border p-3 flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[meta.tone]}`}
                >
                  <span>{draftLabels[key].emoji}</span>
                  {draftLabels[key].label || DEFAULT_TITLES[key]}
                </span>
                <div className="flex-1 grid grid-cols-[1fr_64px] gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">
                      Name for “{DEFAULT_TITLES[key]}”
                    </Label>
                    <Input
                      value={draftLabels[key].label}
                      onChange={(e) => patchLabel(key, "label", e.target.value)}
                      placeholder={DEFAULT_TITLES[key]}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Emoji</Label>
                    <Input
                      value={draftLabels[key].emoji}
                      onChange={(e) => patchLabel(key, "emoji", e.target.value)}
                      className="h-8 text-sm text-center"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Rename any category (e.g. “Healthy” → “Thriving”, “Burnout risk” → “Over Achievers”) and
          pick the emoji shown next to it.
        </p>
      </div>

      {/* Rules */}
      <div className="space-y-3 border-t pt-4">
        <div className="text-sm font-medium">Rules &amp; thresholds</div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-1.5 sm:col-span-3">
            <Label className="text-xs">Default calculation mode</Label>
            <Select
              value={draftSettings.mode}
              onValueChange={(v) => patchS({ mode: v as HealthMode })}
            >
              <SelectTrigger className="w-full max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODE_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {MODE_OPTIONS.find((m) => m.value === draftSettings.mode)?.hint}
            </p>
          </div>
          {draftSettings.mode === "past" && (
            <HealthNumberField
              label="Look back (weeks)"
              min={1}
              value={draftSettings.pastWeeks}
              onChange={(n) => patchS({ pastWeeks: n })}
            />
          )}
          {draftSettings.mode === "future" && (
            <HealthNumberField
              label="Look ahead (weeks)"
              min={1}
              value={draftSettings.futureWeeks}
              onChange={(n) => patchS({ futureWeeks: n })}
            />
          )}
          {draftSettings.mode === "range" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Start date</Label>
                <Input
                  type="date"
                  value={draftSettings.rangeStart}
                  onChange={(e) => patchS({ rangeStart: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End date</Label>
                <Input
                  type="date"
                  value={draftSettings.rangeEnd}
                  onChange={(e) => patchS({ rangeEnd: e.target.value })}
                />
              </div>
            </>
          )}
          {countModes && (
            <>
              <HealthNumberField
                label={`“${draftLabels.healthy.label || "Healthy"}” minimum serves`}
                min={1}
                value={draftSettings.lowThreshold + 1}
                onChange={(n) => patchS({ lowThreshold: Math.max(0, n - 1) })}
                hint={`At least this many serves; fewer shows “${draftLabels.could_do_more.label}”`}
              />
              <HealthNumberField
                label={`“${draftLabels.healthy.label || "Healthy"}” maximum serves`}
                min={1}
                value={Math.max(1, draftSettings.highThreshold - 1)}
                onChange={(n) => patchS({ highThreshold: n + 1 })}
                hint={`Up to this many serves; more shows “${draftLabels.burnout.label}”`}
              />
              <HealthNumberField
                label={`“${draftLabels.burnout.label || "Over-served"}” at (serves ≥)`}
                min={1}
                value={draftSettings.highThreshold}
                onChange={(n) => patchS({ highThreshold: n })}
                hint="Flags red"
              />
              <HealthNumberField
                label={`“${draftLabels.could_do_more.label || "Could do more"}” at (serves ≤)`}
                value={draftSettings.lowThreshold}
                onChange={(n) => patchS({ lowThreshold: n })}
                hint="Flags yellow"
              />
            </>
          )}
          {draftSettings.mode === "preference" && (
            <>
              <HealthNumberField
                label={`“${draftLabels.healthy.label || "Healthy"}” starts at (% of preference)`}
                value={draftSettings.healthyMinimumPct}
                onChange={(n) => patchS({ healthyMinimumPct: Math.min(100, n) })}
                hint={`Below this shows “${draftLabels.could_do_more.label}”`}
              />
              <HealthNumberField
                label={`“${draftLabels.healthy.label || "Healthy"}” allowance above preference (%)`}
                value={draftSettings.tolerancePct}
                onChange={(n) => patchS({ tolerancePct: n })}
                hint={`Above this shows “${draftLabels.burnout.label}”`}
              />
            </>
          )}
          {draftSettings.mode === "consecutive" && (
            <p className="text-xs text-muted-foreground sm:col-span-3 rounded-lg border bg-muted/30 p-3">
              “{draftLabels.healthy.label || "Healthy"}” applies when someone has served before and
              their longest streak is fewer than {draftSettings.noRestStreak} consecutive weeks.
              Adjust the no-rest threshold below to change this.
            </p>
          )}
          <HealthNumberField
            label={`“${draftLabels.burnout.label || "Burnout"}” streak (weeks in a row)`}
            min={2}
            value={draftSettings.burnoutStreak}
            onChange={(n) => patchS({ burnoutStreak: n })}
            hint="Consecutive weeks that flag red"
          />
          <HealthNumberField
            label={`“${draftLabels.no_rest.label || "No rest"}” streak (weeks in a row)`}
            min={1}
            value={draftSettings.noRestStreak}
            onChange={(n) => patchS({ noRestStreak: n })}
            hint="Back-to-back weeks that flag amber"
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
          <div>
            <Label className="text-sm">Include paused volunteers</Label>
            <p className="text-[11px] text-muted-foreground">
              Show people who have paused serving in the Team Health table.
            </p>
          </div>
          <Switch
            checked={draftSettings.includePaused}
            onCheckedChange={(c) => patchS({ includePaused: c })}
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <Button variant="outline" onClick={resetDefaults}>
          Reset to defaults
        </Button>
        <Button onClick={save} disabled={!dirty}>
          {dirty ? "Save settings" : "Saved"}
        </Button>
      </div>
    </div>
  );
}
