import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  Cake,
  CalendarDays,
  FileText,
  HeartHandshake,
  Home,
  LayoutGrid,
  Printer,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { useRoster } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import {
  canViewDiscipleship,
  canViewHealth,
  canViewIndividuals,
  canViewLifeGroups,
  canViewRosterPage,
} from "@/lib/user-access";
import {
  upcomingBirthdays,
  birthdayLabel,
  whatsappBirthdayUrl,
} from "@/lib/birthdays";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Roster Pulse — Church Roster Home" },
      {
        name: "description",
        content:
          "Home menu for Roster Pulse: jump into the live Sunday roster, family, team health, life groups and print docs.",
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
    title: "Family",
    to: "/volunteers",
    icon: Users,
    blurb: "Directory of every family member, preferences, pastoral notes and pauses.",
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
  {
    title: "Discipleship",
    to: "/discipleship",
    icon: HeartHandshake,
    blurb: "Connect cards, follow-up stages and interest pathways like Baptism and Alpha.",
  },
  {
    title: "User Access",
    to: "/users",
    icon: Shield,
    blurb: "Leader logins, page access, area scopes and Team Health settings.",
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
      case "/roster":
        return canViewRosterPage(isMaster, authUser);
      case "/volunteers":
        return canViewIndividuals(isMaster, authUser);
      case "/health":
        return canViewHealth(isMaster, authUser);
      case "/teams":
        return isMaster || (authUser?.teamEditAreas ?? []).length > 0;
      case "/life-groups":
        return canViewLifeGroups(isMaster, authUser);
      case "/discipleship":
        return canViewDiscipleship(isMaster, authUser);
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
            {volunteers.length} family members
          </span>
          <span className="rounded-full border bg-card px-3 py-1">{dates.length} Sundays</span>
          <span className="rounded-full border bg-card px-3 py-1">
            {lifeGroups.length} life groups
          </span>
        </div>
      </header>

      <BirthdayCard />

      <nav className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {allowedTiles.map((tile) => (
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

function BirthdayCard() {
  const volunteers = useRoster((s) => s.volunteers);
  const lifeGroups = useRoster((s) => s.lifeGroups);
  const isMaster = useAuth((s) => s.master);
  const authUser = useAuth((s) => s.user);

  const reminders = upcomingBirthdays({
    volunteers,
    lifeGroups,
    isMaster,
    user: authUser,
    withinDays: 7,
  });

  if (reminders.length === 0) return null;

  return (
    <section className="mb-8 rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-primary">
        <Cake className="h-5 w-5" />
        <h2 className="text-sm font-semibold uppercase tracking-widest">
          Birthdays this week
        </h2>
      </div>
      <ul className="space-y-3">
        {reminders.map(({ person, inDays, nextDate, reasons }) => {
          const wa = whatsappBirthdayUrl(person.full_name, person.phone);
          return (
            <li
              key={person.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{person.full_name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      inDays === 0
                        ? "bg-primary text-primary-foreground"
                        : "border bg-muted text-muted-foreground"
                    }`}
                  >
                    {birthdayLabel(inDays, nextDate)}
                  </span>
                </div>
                {reasons.length > 0 && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {reasons.slice(0, 3).join(" · ")}
                  </p>
                )}
              </div>
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700"
                >
                  WhatsApp birthday wish
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
