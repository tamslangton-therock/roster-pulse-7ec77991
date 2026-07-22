import { useEffect, useState, type ReactNode } from "react";
import { useRoster } from "@/lib/store";

export function HydrateStore({ children }: { children: ReactNode }) {
  const hydrate = useRoster((s) => s.hydrate);
  const ready = useRoster((s) => s.ready);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    hydrate();
  }, [hydrate]);

  if (!mounted || !ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading Roster Pulse…
      </div>
    );
  }
  return <>{children}</>;
}
