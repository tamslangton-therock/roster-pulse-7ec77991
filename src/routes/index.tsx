import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  CalendarDays,
  FileText,
  Home,
  LayoutGrid,
  Printer,
  Sparkles,
  Users,
} from "lucide-react";
import { useRoster } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import {
  canEditTeamsArea,
  canViewHealth,
  canViewIndividuals,
} from "@/lib/user-access";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Roster Pulse — Church Roster Home" },
      {
        name: "description",
        content:
          "Home menu for Roster Pulse: jump into the live Sunday roster, individuals, team health, life groups and print docs.",
      },
      { property: "og:title", content: "Roster Pulse — Church Roster Home" },
      {
        property: "og:description",
        content:
          "One place to manage Sunday rosters, volunteers and life groups.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HomeMenu,
});

const tiles = [
  {
    title: "Live Roster",
    to: "/roster",
    icon: CalendarDays,
    blurb: "Build and edit the Sunday schedule, spot clashes and swap people.",
  },
  {
    title: "Individuals",
    to: "/volunteers",
    icon: Users,
    blurb: "Directory of everyone, preferences, pastoral notes and pauses.",
  },
  {
    title: "Team Health",
    to: "/health",
    icon: Activity,
    blurb: "Fatigue and burnout tracking across 4 and 8 week windows.",
  },
  {
    title: "Team Builder",
    to: "/teams",
    icon: LayoutGrid,
    blurb: "Set up teams and ideal sub-teams you can drop onto a Sunday.",
  },
  {
    title: "Team Print",
    to: "/print",
    icon: Printer,
    blurb: "Colour-coded PDFs per team, plus generated Sunday docs.",
  },
  {
    title: "Doc Templates",
    to: "/docs",
    icon: FileText,
    blurb: "Edit the huddle and hosting templates the generator fills in.",
  },
  {
    title: "Life Groups",
    to: "/life-groups",
    icon: Home,
    blurb: "Groups, leaders, meeting details and member rosters.",
  },
] as const;

function HomeMenu() {
  const volunteers = useRoster((s) => s.volunteers);
  const dates = useRoster((s) => s.dates);
  const lifeGroups = useRoster((s) => s.lifeGroups);
  const isMaster = useAuth((s) => s.master);
  const authUser = useAuth((s) => s.user);

  const allowedTiles = tiles.filter((tile) => {
    switch (tile.to) {
      case "/volunteers":
        return canViewIndividuals(isMaster, authUser);
      case "/health":
        return canViewHealth(isMaster, authUser);
      case "/teams":
        return isMaster || (authUser?.teamEditAreas ?? []).length > 0;
      default:
        return isMaster;
    }
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14">
      <header className="mb-10">
        <div className="mb-3 flex items-center gap-2 text-primary">
          <Sparkles className="h-5 w-5" />
          <span className="text-xs font-medium uppercase tracking-widest">Roster Pulse</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          What would you like to work on?
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Pick a section below, or use the sidebar at any time.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border bg-card px-3 py-1">
            {volunteers.length} individuals
          </span>
          <span className="rounded-full border bg-card px-3 py-1">{dates.length} Sundays</span>
          <span className="rounded-full border bg-card px-3 py-1">
            {lifeGroups.length} life groups
          </span>
        </div>
      </header>

      <nav className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <Link
            key={tile.to}
            to={tile.to}
            className="group rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <tile.icon className="h-5 w-5" />
            </div>
            <div className="text-base font-medium tracking-tight">{tile.title}</div>
            <p className="mt-1 text-sm text-muted-foreground">{tile.blurb}</p>
          </Link>
        ))}
      </nav>
    </div>
  );
}
