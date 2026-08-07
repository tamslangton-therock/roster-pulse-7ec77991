import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, MapPin, Plus, Trash2, Users } from "lucide-react";
import { useRoster } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { ProfileHoverCard } from "@/components/profile-hover-card";
import { teamColor } from "@/lib/person-colors";

export const Route = createFileRoute("/life-groups")({
  head: () => ({
    meta: [
      { title: "Life Groups — Roster Pulse" },
      {
        name: "description",
        content:
          "Create and manage church life groups, their leaders, meeting times, locations and members.",
      },
      { property: "og:title", content: "Life Groups — Roster Pulse" },
      {
        property: "og:description",
        content:
          "Life group directory with leaders, meeting day and time, location and unlimited members — synced to Google Sheets.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LifeGroupsPage,
});

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function splitDayTime(value: string): { day: string; time: string } {
  const [day = "", time = ""] = value.split("|").map((s) => s.trim());
  return { day, time };
}

function LifeGroupsPage() {
  const {
    lifeGroups,
    volunteers,
    addLifeGroup,
    updateLifeGroup,
    removeLifeGroup,
    addLifeGroupMember,
    removeLifeGroupMember,
  } = useRoster();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...lifeGroups].sort((a, b) =>
      a.GroupName.localeCompare(b.GroupName),
    );
    if (!q) return sorted;
    return sorted.filter(
      (g) =>
        g.GroupName.toLowerCase().includes(q) ||
        g.Leaders.toLowerCase().includes(q) ||
        g.LocationName.toLowerCase().includes(q) ||
        g.MembersList.some((m) => m.toLowerCase().includes(q)),
    );
  }, [lifeGroups, query]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Life Groups</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lifeGroups.length} group{lifeGroups.length === 1 ? "" : "s"} — saved to the{" "}
            <span className="font-medium">Life_Groups</span> tab in Google Sheets.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search groups, leaders, members…"
            className="w-[240px]"
          />
          <Button
            onClick={() => {
              setNewName("");
              setCreating(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Create New Life Group
          </Button>
        </div>
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {lifeGroups.length === 0
            ? "No life groups yet. Create your first one to get started."
            : "No groups match that search."}
        </p>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {filtered.map((group) => (
          <section
            key={group.GroupID}
            className="rounded-xl border bg-card p-4 shadow-sm space-y-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Life Group Name</Label>
                  <Input
                    value={group.GroupName}
                    onChange={(e) =>
                      updateLifeGroup(group.GroupID, { GroupName: e.target.value })
                    }
                    placeholder="e.g. Northside Life Group"
                  />
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-destructive"
                title="Delete life group"
                onClick={() => {
                  removeLifeGroup(group.GroupID);
                  toast.info(`Removed ${group.GroupName || "life group"}`);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Leader name(s)</Label>
                <LeaderPicker
                  value={group.Leaders}
                  names={volunteers.map((v) => v.full_name)}
                  onChange={(v) => updateLifeGroup(group.GroupID, { Leaders: v })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Meeting day</Label>
                <Select
                  value={splitDayTime(group.MeetingDayTime).day || undefined}
                  onValueChange={(day) =>
                    updateLifeGroup(group.GroupID, {
                      MeetingDayTime: `${day} | ${splitDayTime(group.MeetingDayTime).time}`,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Meeting time</Label>
                <Input
                  type="time"
                  value={splitDayTime(group.MeetingDayTime).time}
                  onChange={(e) =>
                    updateLifeGroup(group.GroupID, {
                      MeetingDayTime: `${splitDayTime(group.MeetingDayTime).day} | ${e.target.value}`,
                    })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Location name</Label>
                <Input
                  value={group.LocationName}
                  onChange={(e) =>
                    updateLifeGroup(group.GroupID, { LocationName: e.target.value })
                  }
                  placeholder="The Smith's House / Room 201"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Street address</Label>
                <div className="relative">
                  <MapPin className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    value={group.StreetAddress}
                    onChange={(e) =>
                      updateLifeGroup(group.GroupID, { StreetAddress: e.target.value })
                    }
                    placeholder="12 Oak Avenue, Sandton"
                  />
                </div>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Description</Label>
                <Textarea
                  rows={3}
                  value={group.Description}
                  onChange={(e) =>
                    updateLifeGroup(group.GroupID, { Description: e.target.value })
                  }
                  placeholder="Who this group is for, what a typical evening looks like…"
                />
              </div>
            </div>

            {/* Members */}
            <div className="rounded-lg border bg-background p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4" /> Members
                  <span className="text-xs text-muted-foreground font-normal">
                    ({group.MembersList.length})
                  </span>
                </div>
                <MemberPicker
                  names={volunteers.map((v) => v.full_name)}
                  exclude={group.MembersList}
                  onPick={(name) => {
                    addLifeGroupMember(group.GroupID, name);
                    toast.success(`${name} added to ${group.GroupName || "group"}`);
                  }}
                />
              </div>

              {group.MembersList.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No members yet — add as many people as you like.
                </p>
              ) : (
                <ul className="divide-y">
                  {group.MembersList.map((m) => {
                    const c = teamColor(m);
                    return (
                      <li key={m} className="flex items-center justify-between py-1.5">
                        <ProfileHoverCard name={m}>
                          <span
                            className="cursor-default rounded-md px-2 py-0.5 text-sm"
                            style={{ backgroundColor: c.bg, color: c.text }}
                          >
                            {m}
                          </span>
                        </ProfileHoverCard>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          title={`Remove ${m}`}
                          onClick={() => removeLifeGroupMember(group.GroupID, m)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        ))}
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New life group</DialogTitle>
            <DialogDescription>
              Give the group a name — you can fill in leaders, meeting details and members
              next.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Life group name"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!newName.trim()) return;
                addLifeGroup(newName.trim());
                setCreating(false);
                toast.success("Life group created");
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

function MemberPicker({
  names,
  exclude,
  onPick,
}: {
  names: string[];
  exclude: string[];
  onPick: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const options = useMemo(
    () => names.filter((n) => !exclude.includes(n)).sort((a, b) => a.localeCompare(b)),
    [names, exclude],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" /> Add member
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end">
        <Command>
          <CommandInput placeholder="Search volunteers…" />
          <CommandList>
            <CommandEmpty>No one found.</CommandEmpty>
            <CommandGroup>
              {options.map((n) => (
                <CommandItem
                  key={n}
                  value={n}
                  onSelect={() => {
                    onPick(n);
                    setOpen(false);
                  }}
                >
                  {n}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function LeaderPicker({
  value,
  names,
  onChange,
}: {
  value: string;
  names: string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = value
    .split(/\s*[|,;]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  const toggle = (name: string) => {
    const next = selected.includes(name)
      ? selected.filter((s) => s !== name)
      : [...selected, name];
    onChange(next.join(", "));
  };

  const options = useMemo(() => [...names].sort((a, b) => a.localeCompare(b)), [names]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between font-normal">
          <span className="truncate">
            {selected.length > 0 ? selected.join(", ") : "Select leader(s)"}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search volunteers…" />
          <CommandList>
            <CommandEmpty>No one found.</CommandEmpty>
            <CommandGroup>
              {options.map((n) => (
                <CommandItem key={n} value={n} onSelect={() => toggle(n)}>
                  <Check
                    className={`mr-2 h-4 w-4 ${selected.includes(n) ? "opacity-100" : "opacity-0"}`}
                  />
                  {n}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
