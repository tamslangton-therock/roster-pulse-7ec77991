import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { Users, LayoutDashboard, Calendar } from "lucide-react";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Navigation */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-bold text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <span>Roster Pulse</span>
            </Link>

            <nav className="flex items-center gap-4 text-sm font-medium">
              <Link
                to="/"
                activeProps={{ className: "text-primary font-semibold" }}
                inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
                className="transition-colors flex items-center gap-1.5"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
              <Link
                to="/volunteers"
                activeProps={{ className: "text-primary font-semibold" }}
                inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
                className="transition-colors flex items-center gap-1.5"
              >
                <Users className="h-4 w-4" />
                Volunteers
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="flex-1 container mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
