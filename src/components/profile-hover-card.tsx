import { useState, type ReactNode } from "react";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { UserRound } from "lucide-react";
import { useRoster, findVolunteer } from "@/lib/store";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  VolunteerForm,
  emptyDraft,
  toDraft,
  type VolunteerDraft,
} from "@/components/volunteer-form";
import { toast } from "sonner";
import { teamColor } from "@/lib/person-colors";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function Section({ title, body }: { title: string; body?: string }) {
  if (!body?.trim()) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <p className="text-xs whitespace-pre-wrap leading-relaxed">{body}</p>
    </div>
  );
}

/**
 * Hover preview of a person's pastoral profile (context / challenges / praying for).
 * Wraps any inline element — the trigger keeps its own layout, so clicking the
 * name still performs the host action (e.g. swap). Opening the full profile
 * editor happens through the "Open profile" button inside the hover card.
 */
export function ProfileHoverCard({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  const volunteers = useRoster((s) => s.volunteers);
  const updateVolunteer = useRoster((s) => s.updateVolunteer);
  const person = findVolunteer(volunteers, name);
  const color = teamColor(name);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<VolunteerDraft>(emptyDraft);

  const hasNotes = Boolean(
    person?.context?.trim() ||
      person?.challenges?.trim() ||
      person?.praying_for?.trim(),
  );

  const allNames = volunteers
    .map((v) => v.full_name)
    .filter((n) => Boolean(n) && n !== person?.full_name)
    .sort();

  const openProfile = () => {
    if (!person) {
      toast.error(`${name} is not in the directory yet`);
      return;
    }
    setDraft(toDraft(person));
    setOpen(true);
  };

  const save = () => {
    if (!person || !draft.full_name.trim()) return;
    updateVolunteer(person.id, {
      ...draft,
      full_name: draft.full_name.trim(),
      max_serving_per_month: Number(draft.max_serving_per_month) || 0,
    });
    setOpen(false);
    toast.success("Profile updated");
  };

  return (
    <>
      <HoverCard openDelay={200} closeDelay={120}>
        <HoverCardTrigger asChild>{children}</HoverCardTrigger>
        <HoverCardPrimitive.Portal>
          <HoverCardContent className="w-72 space-y-2.5" side="top" align="start">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                style={{ backgroundColor: color.bg, color: color.text }}
              >
                {initials(name)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {(person?.serving_areas ?? []).join(", ") || "No serving areas"}
                </p>
              </div>
            </div>

            {hasNotes ? (
              <div className="space-y-2 border-t pt-2">
                <Section title="Context" body={person?.context} />
                <Section title="Challenges" body={person?.challenges} />
                <Section title="Praying for" body={person?.praying_for} />
              </div>
            ) : (
              <p className="border-t pt-2 text-xs text-muted-foreground">
                No context, challenges or prayer notes yet.
              </p>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openProfile();
              }}
            >
              <UserRound className="h-3.5 w-3.5" />
              Open profile
            </Button>
          </HoverCardContent>
        </HoverCardPrimitive.Portal>
      </HoverCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{person?.full_name ?? name}</DialogTitle>
            <DialogDescription>
              Edit serving areas, blockouts and pastoral notes — changes sync to
              the sheet.
            </DialogDescription>
          </DialogHeader>

          <VolunteerForm draft={draft} onChange={setDraft} allNames={allNames} />

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
