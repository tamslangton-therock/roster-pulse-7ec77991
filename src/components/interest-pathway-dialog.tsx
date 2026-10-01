import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  fetchDiscipleship,
  writeDiscipleship,
  type DiscipleshipRow,
} from "@/lib/sheets.functions";
import { useInterestList, interestEmoji } from "@/lib/interest-list";
import { personKey } from "@/lib/person-link";
import type { Volunteer } from "@/lib/types";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Two-way flow: put an existing Family member into discipleship interest pools
 * (Baptism, Alpha, …) without changing their profile or serving status.
 */
export function InterestPathwayDialog({
  volunteer,
  open,
  onOpenChange,
}: {
  volunteer: Volunteer | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { interests } = useInterestList();
  const { data: rows = [] } = useQuery({
    queryKey: ["discipleship"],
    queryFn: async () => (await fetchDiscipleship()) as DiscipleshipRow[],
    enabled: open,
  });

  if (!volunteer) return null;
  const card = rows.find((r) => personKey(r.person_name) === personKey(volunteer.full_name));

  const save = (next: DiscipleshipRow[], msg: string) => {
    queryClient.setQueryData<DiscipleshipRow[]>(["discipleship"], next);
    void writeDiscipleship({ data: { rows: next } })
      .then(() => toast.success(msg))
      .catch(() => toast.error("Couldn't save to the sheet — check your connection and try again."));
  };

  const setInterest = (name: string, on: boolean) => {
    if (!card) {
      if (!on) return;
      const row: DiscipleshipRow = {
        id: `dc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        person_name: volunteer.full_name,
        phone: volunteer.phone ?? "",
        email: volunteer.email ?? "",
        date_connected: today(),
        source: "Family directory",
        stage: "needs_contact",
        contacted: false,
        contacted_date: "",
        interests: [name],
        interest_done: [],
        assigned_to: "",
        plugged_in_date: "",
        notes: `Added from the Family directory — already ${volunteer.is_volunteer !== false ? "serving" : "in the directory"}.`,
      };
      save([row, ...rows], `${volunteer.full_name} added to ${name}.`);
      return;
    }
    const next = rows.map((r) =>
      r.id !== card.id
        ? r
        : on
          ? {
              ...r,
              interests: r.interests.includes(name) ? r.interests : [...r.interests, name],
            }
          : {
              ...r,
              interests: r.interests.filter((i) => i !== name),
              interest_done: r.interest_done.filter((i) => i !== name),
            },
    );
    save(next, on ? `${volunteer.full_name} added to ${name}.` : `${volunteer.full_name} removed from ${name}.`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Interest pathways — {volunteer.full_name}</DialogTitle>
          <DialogDescription>
            Add them to a list like Baptism or Alpha. This never changes their Family profile or
            serving — it just tracks what they’d like next.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          {interests.map((def) => {
            const on = card?.interests.includes(def.name) ?? false;
            const done = card?.interest_done.includes(def.name) ?? false;
            return (
              <label
                key={def.name}
                className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm cursor-pointer hover:bg-accent/50"
              >
                <Checkbox checked={on} onCheckedChange={(v) => setInterest(def.name, v === true)} />
                <span>{interestEmoji(def.emoji, def.name)} {def.name}</span>
                {on && done && (
                  <span className="ml-auto text-[11px] text-emerald-700">seen to ✓</span>
                )}
              </label>
            );
          })}
        </div>
        {!card && (
          <p className="text-xs text-muted-foreground">
            They don’t have a connect card yet — ticking an interest creates one linked to this
            profile.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
