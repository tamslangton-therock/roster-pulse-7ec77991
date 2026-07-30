import { useState } from "react";
import { X, Plus } from "lucide-react";
import type { Volunteer } from "@/lib/types";
import { ROSTER_AREAS } from "@/lib/roster-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type VolunteerDraft = {
  full_name: string;
  email: string;
  phone: string;
  serving_areas: string[];
  partners: string[];
  max_serving_per_month: number;
  frequency_preference: string;
  priority_area: string;
  is_paused: boolean;
  notes: string;
  unavailable_dates: string[];
};

export const FREQUENCIES = [
  "1x/month",
  "2x/month",
  "fortnightly",
  "weekly",
  "as needed",
];

export function emptyDraft(): VolunteerDraft {
  return {
    full_name: "",
    email: "",
    phone: "",
    serving_areas: [],
    partners: [],
    max_serving_per_month: 2,
    frequency_preference: "2x/month",
    priority_area: "",
    is_paused: false,
    notes: "",
    unavailable_dates: [],
  };
}

export function toDraft(v: Volunteer): VolunteerDraft {
  return {
    full_name: v.full_name ?? "",
    email: v.email ?? "",
    phone: v.phone ?? "",
    serving_areas: v.serving_areas ?? [],
    partners: v.partners ?? [],
    max_serving_per_month: v.max_serving_per_month ?? 2,
    frequency_preference: v.frequency_preference ?? "",
    priority_area: v.priority_area ?? "",
    is_paused: Boolean(v.is_paused),
    notes: v.notes ?? "",
    unavailable_dates: v.unavailable_dates ?? [],
  };
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
      {children}
    </label>
  );
}

function Chips({
  items,
  onRemove,
}: {
  items: string[];
  onRemove: (item: string) => void;
}) {
  if (!items.length)
    return <p className="text-xs text-muted-foreground">None yet</p>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
        >
          {item}
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onRemove(item)}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

export function VolunteerForm({
  draft,
  onChange,
  allNames = [],
}: {
  draft: VolunteerDraft;
  onChange: (next: VolunteerDraft) => void;
  allNames?: string[];
}) {
  const [areaPick, setAreaPick] = useState("");
  const [customArea, setCustomArea] = useState("");
  const [partnerInput, setPartnerInput] = useState("");
  const [dateInput, setDateInput] = useState("");

  const set = <K extends keyof VolunteerDraft>(
    key: K,
    value: VolunteerDraft[K]
  ) => onChange({ ...draft, [key]: value });

  const addArea = (area: string) => {
    const a = area.trim();
    if (!a || draft.serving_areas.includes(a)) return;
    set("serving_areas", [...draft.serving_areas, a]);
  };

  const availableAreas = ROSTER_AREAS.filter(
    (a) => !draft.serving_areas.includes(a)
  );

  return (
    <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Full name</Label>
          <Input
            value={draft.full_name}
            onChange={(e) => set("full_name", e.target.value)}
            placeholder="Jane Doe"
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            value={draft.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="jane@example.com"
          />
        </div>
        <div>
          <Label>Phone</Label>
          <Input
            value={draft.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+27 …"
          />
        </div>
        <div>
          <Label>Max serves / month</Label>
          <Input
            type="number"
            min={0}
            max={10}
            value={draft.max_serving_per_month}
            onChange={(e) =>
              set("max_serving_per_month", Number(e.target.value))
            }
          />
        </div>
        <div>
          <Label>Serving frequency preference</Label>
          <Select
            value={draft.frequency_preference || undefined}
            onValueChange={(v) => set("frequency_preference", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose frequency" />
            </SelectTrigger>
            <SelectContent>
              {Array.from(
                new Set(
                  [...FREQUENCIES, draft.frequency_preference].filter(Boolean)
                )
              ).map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Priority area</Label>
          <Select
            value={draft.priority_area || "none"}
            onValueChange={(v) => set("priority_area", v === "none" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose area" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No priority</SelectItem>
              {Array.from(
                new Set([...ROSTER_AREAS, ...draft.serving_areas])
              ).map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border p-3 space-y-2">
        <Label>Serving areas</Label>
        <Chips
          items={draft.serving_areas}
          onRemove={(a) =>
            set(
              "serving_areas",
              draft.serving_areas.filter((x) => x !== a)
            )
          }
        />
        <div className="flex flex-wrap gap-2 pt-1">
          <Select
            value={areaPick}
            onValueChange={(v) => {
              addArea(v);
              setAreaPick("");
            }}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Add serving area" />
            </SelectTrigger>
            <SelectContent>
              {availableAreas.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-1">
            <Input
              className="w-[180px]"
              placeholder="Custom area"
              value={customArea}
              onChange={(e) => setCustomArea(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addArea(customArea);
                  setCustomArea("");
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => {
                addArea(customArea);
                setCustomArea("");
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-md border p-3 space-y-2">
        <Label>Partners / family links</Label>
        <Chips
          items={draft.partners}
          onRemove={(p) =>
            set(
              "partners",
              draft.partners.filter((x) => x !== p)
            )
          }
        />
        <div className="flex gap-1 pt-1">
          <Input
            list="volunteer-names"
            className="w-[240px]"
            placeholder="Partner name"
            value={partnerInput}
            onChange={(e) => setPartnerInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const p = partnerInput.trim();
                if (p && !draft.partners.includes(p))
                  set("partners", [...draft.partners, p]);
                setPartnerInput("");
              }
            }}
          />
          <datalist id="volunteer-names">
            {allNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => {
              const p = partnerInput.trim();
              if (p && !draft.partners.includes(p))
                set("partners", [...draft.partners, p]);
              setPartnerInput("");
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-md border p-3 space-y-2">
        <Label>Unavailable dates</Label>
        <Chips
          items={draft.unavailable_dates}
          onRemove={(d) =>
            set(
              "unavailable_dates",
              draft.unavailable_dates.filter((x) => x !== d)
            )
          }
        />
        <div className="flex gap-1 pt-1">
          <Input
            type="date"
            className="w-[180px]"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => {
              if (dateInput && !draft.unavailable_dates.includes(dateInput))
                set("unavailable_dates", [
                  ...draft.unavailable_dates,
                  dateInput,
                ]);
              setDateInput("");
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <p className="text-sm font-medium">Paused from serving</p>
          <p className="text-xs text-muted-foreground">
            Paused volunteers are excluded from swaps and flagged on the roster.
          </p>
        </div>
        <Switch
          checked={draft.is_paused}
          onCheckedChange={(v) => set("is_paused", v)}
        />
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea
          rows={3}
          value={draft.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="e.g. Serves with Audrey, prefers early service"
        />
      </div>
    </div>
  );
}
