import { useEffect, useState } from "react";
import { Check, CloudUpload, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useRoster, flushPendingSync } from "@/lib/store";
import { Button } from "@/components/ui/button";

/**
 * Floating "Save to Google Sheets" control.
 * Changes already sync automatically a moment after each edit — this lets you
 * force the write through before navigating away, and shows what's pending.
 */
export function SaveBar({ inline = false, label = "Save changes" }: { inline?: boolean; label?: string }) {
  const pending = useRoster((s) => s.pendingWrites);
  const syncStatus = useRoster((s) => s.syncStatus);
  const error = useRoster((s) => s.error);
  const ready = useRoster((s) => s.ready);
  const [saving, setSaving] = useState(false);

  // Flush queued writes if the tab is hidden or closed with edits pending.
  useEffect(() => {
    const flush = () => {
      if (useRoster.getState().pendingWrites > 0) void flushPendingSync();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }, []);

  if (!ready) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await flushPendingSync();
      // A queued write can already be in flight when the button is pressed.
      while (useRoster.getState().syncStatus === "syncing" || useRoster.getState().pendingWrites > 0) {
        if (useRoster.getState().error) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (useRoster.getState().error) toast.error("Some changes failed to save — please retry");
      else toast.success("All changes saved");
    } catch {
      toast.error("Couldn't save changes — please retry");
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || syncStatus === "syncing" || pending > 0;

  return (
    <div className={inline ? "print:hidden" : "fixed bottom-4 right-4 z-50 print:hidden"}>
      <Button
        size="sm"
        variant={error ? "destructive" : busy ? "default" : "secondary"}
        onClick={handleSave}
        disabled={saving}
        className="shadow-lg"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : error ? (
          <TriangleAlert className="h-4 w-4" />
        ) : busy ? (
          <CloudUpload className="h-4 w-4" />
        ) : (
          <Check className="h-4 w-4" />
        )}
        {error
          ? "Sync error — retry"
          : saving
            ? "Saving…"
            : pending > 0
              ? `Save now (${pending} pending)`
              : syncStatus === "syncing"
                ? "Saving…"
                : label}
      </Button>
    </div>
  );
}
