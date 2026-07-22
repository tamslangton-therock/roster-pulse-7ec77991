import { cn } from "@/lib/utils";
import type { FatigueStatus } from "@/lib/types";
import { statusMeta } from "@/lib/roster-engine";

const toneClasses: Record<string, string> = {
  green: "bg-status-green text-status-green-foreground",
  yellow: "bg-status-yellow text-status-yellow-foreground",
  amber: "bg-status-amber text-status-amber-foreground",
  red: "bg-status-red text-status-red-foreground",
  blue: "bg-status-blue text-status-blue-foreground",
  slate: "bg-status-slate text-status-slate-foreground",
};

export function StatusBadge({
  status,
  className,
  showEmoji = true,
}: {
  status: FatigueStatus;
  className?: string;
  showEmoji?: boolean;
}) {
  const meta = statusMeta(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        toneClasses[meta.tone],
        className,
      )}
    >
      {showEmoji && <span>{meta.emoji}</span>}
      {meta.label}
    </span>
  );
}

export function ToneBadge({
  tone,
  children,
  className,
}: {
  tone: "green" | "yellow" | "amber" | "red" | "blue" | "slate";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
