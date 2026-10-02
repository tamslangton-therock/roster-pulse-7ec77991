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
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  type BirthdayMessageTemplate,
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
  const templates = useRoster((s) => s.birthdayTemplates);
  const setBirthdayTemplates = useRoster((s) => s.setBirthdayTemplates);
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id ?? "default");

  useEffect(() => {
    if (!templates.some((template) => template.id === selectedTemplateId)) {
      setSelectedTemplateId(templates[0]?.id ?? "default");
    }
  }, [selectedTemplateId, templates]);

  const selectedTemplate =
    templates.find((template) => template.id === selectedTemplateId) ?? templates[0];

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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-primary">
          <Cake className="h-5 w-5" />
          <h2 className="text-sm font-semibold uppercase tracking-widest">
            Birthdays this week
          </h2>
        </div>
        {isMaster && (
          <BirthdayTemplateDialog templates={templates} onSave={setBirthdayTemplates} />
        )}
      </div>
      {templates.length > 1 && (
        <div className="mb-4 max-w-sm space-y-1.5">
          <Label htmlFor="birthday-template">Message template</Label>
          <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
            <SelectTrigger id="birthday-template">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <ul className="space-y-3">
        {reminders.map(({ person, inDays, nextDate, reasons }) => {
          const wa = whatsappBirthdayUrl(person.full_name, person.phone, selectedTemplate?.message);
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
              {wa && <Button asChild size="sm"><a href={wa} target="_blank" rel="noreferrer"><MessageCircle />WhatsApp wish</a></Button>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function BirthdayTemplateDialog({
  templates,
  onSave,
}: {
  templates: BirthdayMessageTemplate[];
  onSave: (templates: BirthdayMessageTemplate[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<BirthdayMessageTemplate[]>(templates);

  useEffect(() => {
    if (!open) setDrafts(templates);
  }, [open, templates]);

  const update = (id: string, patch: Partial<BirthdayMessageTemplate>) => {
    setDrafts((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const save = () => {
    const clean = drafts.map((item) => ({
      ...item,
      name: item.name.trim(),
      message: item.message.trim(),
    }));
    if (clean.some((item) => !item.name || !item.message)) {
      toast.error("Each template needs a name and a message.");
      return;
    }
    onSave(clean);
    setOpen(false);
    toast.success("Birthday messages saved for every leader.");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Pencil />Edit messages</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Birthday message templates</DialogTitle>
          <DialogDescription>
            The first template is the default. Use {"{first_name}"} to add the person’s first name automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {drafts.map((template, index) => (
            <div key={template.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label htmlFor={`template-name-${template.id}`}>
                    {index === 0 ? "Default template name" : "Template name"}
                  </Label>
                  <Input
                    id={`template-name-${template.id}`}
                    value={template.name}
                    onChange={(event) => update(template.id, { name: event.target.value })}
                  />
                </div>
                {index > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${template.name || "template"}`}
                    title="Delete template"
                    onClick={() => setDrafts((current) => current.filter((item) => item.id !== template.id))}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`template-message-${template.id}`}>Message</Label>
                <Textarea
                  id={`template-message-${template.id}`}
                  className="min-h-28 resize-y"
                  value={template.message}
                  onChange={(event) => update(template.id, { message: event.target.value })}
                />
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => setDrafts((current) => [
              ...current,
              { id: `birthday-${Date.now()}`, name: "", message: "Hi {first_name}, " },
            ])}
          >
            <Plus />Add template
          </Button>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" onClick={save}>Save templates</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
