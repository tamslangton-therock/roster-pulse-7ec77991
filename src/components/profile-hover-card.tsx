import type { ReactNode } from "react";
import { useRoster, findVolunteer } from "@/lib/store";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { personColor } from "@/lib/person-colors";

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
 * Wraps any inline element — the trigger keeps its own layout.
 */
export function ProfileHoverCard({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  const volunteers = useRoster((s) => s.volunteers);
  const person = findVolunteer(volunteers, name);
  const color = personColor(name);
  const hasNotes = Boolean(
    person?.context?.trim() ||
      person?.challenges?.trim() ||
      person?.praying_for?.trim(),
  );

  return (
    <HoverCard openDelay={200} closeDelay={80}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
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
      </HoverCardContent>
    </HoverCard>
  );
}
