import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, Calendar, ArrowRight } from "lucide-react";
import { useRoster } from "@/lib/store";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  const store = useRoster();
  const volunteers = Array.isArray(store?.volunteers) ? store.volunteers : [];
  const assignments = Array.isArray(store?.assignments) ? store.assignments : [];

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Roster Pulse</h1>
        <p className="text-muted-foreground mt-1">
          Manage volunteer schedules, serving areas, and availability effortlessly.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-xl p-6 bg-card shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Volunteers</h2>
              <p className="text-xs text-muted-foreground">
                {volunteers.length} total volunteer{volunteers.length === 1 ? "" : "s"} on roster
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            View volunteer contact details, set availability, assign serving teams, and manage blackout dates.
          </p>
          <Button asChild size="sm" className="w-full">
            <Link to="/volunteers" className="flex items-center justify-center gap-1.5">
              Manage Volunteers <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="border rounded-xl p-6 bg-card shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Shift Assignments</h2>
              <p className="text-xs text-muted-foreground">
                {assignments.length} scheduled shift{assignments.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Keep track of all rostered shifts across your serving areas and prevent scheduling conflicts.
          </p>
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to="/volunteers" className="flex items-center justify-center gap-1.5">
              View Roster <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
