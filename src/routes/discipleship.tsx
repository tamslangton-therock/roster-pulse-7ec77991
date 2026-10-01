import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Phone,
  Mail,
  Check,
  Plus,
  MessageCircle,
  Inbox,
  UserCheck,
  Handshake,
  Sparkles,
  Search,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useRoster } from "@/lib/store";
import { useLiveUser } from "@/lib/use-live-user";
import { canViewDiscipleship, canEditDiscipleship } from "@/lib/user-access";
import { AccessNotice } from "@/components/access-notice";
import {
  fetchDiscipleship,
  writeDiscipleship,
  type DiscipleshipRow,
} from "@/lib/sheets.functions";
import { findIndividual, personKey } from "@/lib/person-link";
import {
  useInterestList,
  useSaveInterestList,
  interestEmoji,
  DEFAULT_INTERESTS,
} from "@/lib/interest-list";
import type { Volunteer } from "@/lib/types";

export const DEFAULT_INTEREST_NAMES = DEFAULT_INTERESTS.map((i) => i.name);

export const Route = createFileRoute("/discipleship")({
  head: () => ({
    meta: [
      { title: "Discipleship — Roster Pulse" },
      {
        name: "description",
        content:
          "Track new people from first visit to plugged in: contact follow-up, interest requests (Life Groups, Baptism, Alpha, New Partners, Serving) and handover to leaders.",
      },
      { property: "og:title", content: "Discipleship — Roster Pulse" },
      {
        property: "og:description",
        content:
          "New-person pipeline: needs contact, in follow-up, handover and plugged in — with interest tracking and WhatsApp quick contact.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DiscipleshipGate,
});

const STAGES = [
  { id: "needs_contact", label: "Needs Contact", icon: Inbox, hint: "New person — send the first message" },
  { id: "follow_up", label: "In Follow-Up", icon: MessageCircle, hint: "Contacted — working through their requests" },
  { id: "handover", label: "Handover", icon: UserCheck, hint: "Assigned to a leader to pastor" },
  { id: "plugged_in", label: "Plugged In", icon: Handshake, hint: "In a Life Group or serving — done" },
] as const;


const today = () => new Date().toISOString().slice(0, 10);

function stageOf(row: DiscipleshipRow): string {
  if (STAGES.some((s) => s.id === row.stage)) return row.stage;
  return "needs_contact";
}

function daysSince(date: string): number | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

function DiscipleshipGate() {
  const isMaster = useAuth((s) => s.master);
  const user = useLiveUser();
  if (!canViewDiscipleship(isMaster, user)) {
    return (
      <AccessNotice
        title="No access to Discipleship"
        message="Discipleship access is switched on per leader on the User Access page."
      />
    );
  }
  return <DiscipleshipPage />;
}

function DiscipleshipPage() {
  const isMaster = useAuth((s) => s.master);
  const liveUser = useLiveUser();
  const canEdit = canEditDiscipleship(isMaster, liveUser);
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [view, setView] = useState<"pipeline" | "insights">("pipeline");
  const [detailId, setDetailId] = useState<string | null>(null);

  const people = useRoster((s) => s.volunteers);
  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ["discipleship"],
    queryFn: async () => (await fetchDiscipleship()) as DiscipleshipRow[],
  });

  const save = (next: DiscipleshipRow[]) => {
    queryClient.setQueryData<DiscipleshipRow[]>(["discipleship"], next);
    void writeDiscipleship({ data: { rows: next } }).catch(() =>
      toast.error("Couldn't save to the sheet — check your connection and try again."),
    );
  };

  const update = (id: string, patch: Partial<DiscipleshipRow>) => {
    save(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const remove = (id: string) => {
    save(rows.filter((r) => r.id !== id));
    if (detailId === id) setDetailId(null);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) =>
        !q
          ? true
          : [r.person_name, r.phone, r.email, r.assigned_to, r.notes]
              .join(" ")
              .toLowerCase()
              .includes(q),
      )
      .sort((a, b) => (a.date_connected < b.date_connected ? 1 : -1));
  }, [rows, query]);

  const detail = rows.find((r) => r.id === detailId) ?? null;
  const leaderNames = useMemo(
    () =>
      Array.from(
        new Set(
          people
            .flatMap((p) => p.serving_areas)
            .map((a) => a)
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [people],
  );

  const counts = STAGES.map((s) => ({
    id: s.id,
    count: rows.filter((r) => stageOf(r) === s.id).length,
  }));

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Discipleship</h1>
          <p className="text-sm text-muted-foreground">
            New people from first visit to plugged in. Everyone in “Needs Contact” is waiting on a first message.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, phone, leader…"
              className="w-56 pl-8"
            />
          </div>
          {canEdit && (
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> New connect card
            </Button>
          )}
        </div>
      </div>

      {!isLoading && !isError && rows.length > 0 && (
        <div className="inline-flex rounded-lg border bg-card p-0.5">
          {(["pipeline", "insights"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 text-sm capitalize ${
                view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      )}

      {view === "insights" && !isLoading && !isError && rows.length > 0 ? (
        <Insights rows={rows} />
      ) : (
      <>
      {!isLoading && !isError && rows.length > 0 && (
        <InterestPools
          rows={rows}
          canEdit={canEdit}
          onOpen={setDetailId}
          onMarkAllDone={(interest, ids) =>
            save(
              rows.map((r) =>
                ids.includes(r.id) && !r.interest_done.includes(interest)
                  ? { ...r, interest_done: [...r.interest_done, interest] }
                  : r,
              ),
            )
          }
        />
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-16 text-center">Loading pipeline…</p>
      ) : isError ? (
        <p className="text-sm text-destructive py-16 text-center">
          Couldn’t load from the sheet. Refresh to try again.
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center max-w-lg mx-auto mt-10">
          <Sparkles className="h-8 w-8 mx-auto text-muted-foreground" />
          <h2 className="mt-3 text-lg font-semibold">No connect cards yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add someone who visited, filled in a form or reached out — then track their journey to plugged in.
          </p>
          {canEdit && (
            <Button className="mt-4" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> New connect card
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STAGES.map((stage) => {
            const items = filtered.filter((r) => stageOf(r) === stage.id);
            const count = counts.find((c) => c.id === stage.id)?.count ?? 0;
            return (
              <div key={stage.id} className="rounded-xl border bg-card flex flex-col">
                <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                  <stage.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{stage.label}</span>
                  <Badge variant="secondary" className="ml-auto">{count}</Badge>
                </div>
                <p className="px-4 pb-2 text-xs text-muted-foreground">{stage.hint}</p>
                <div className="flex-1 space-y-2 px-3 pb-3 min-h-16">
                  {items.length === 0 && (
                    <p className="text-xs text-muted-foreground px-1 py-3">Nothing here.</p>
                  )}
                  {items.map((r) => {
                    const waiting = daysSince(r.date_connected);
                    const urgent = stage.id === "needs_contact" && (waiting ?? 0) >= 7;
                    const pendingInterests = r.interests.filter((i) => !r.interest_done.includes(i));
                    return (
                      <button
                        key={r.id}
                        onClick={() => setDetailId(r.id)}
                        className={`w-full text-left rounded-lg border p-3 transition-colors hover:bg-accent/50 ${
                          urgent ? "border-destructive/60 bg-destructive/5" : "bg-background"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">{r.person_name}</span>
                          {urgent && (
                            <Badge variant="destructive" className="shrink-0">
                              {waiting}d waiting
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {r.date_connected || "no date"} · {r.source || "connect card"}
                        </p>
                        {r.interests.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {r.interests.map((i) => {
                              const done = r.interest_done.includes(i);
                              return (
                                <span
                                  key={i}
                                  className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] ${
                                    done
                                      ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {INTEREST_ICONS[i] ?? "•"} {i}
                                  {done ? " ✓" : ""}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {r.assigned_to && (
                          <p className="text-[11px] text-muted-foreground mt-2">
                            Handed to: {r.assigned_to}
                          </p>
                        )}
                        {stage.id === "needs_contact" && !r.contacted && pendingInterests.length === 0 && r.interests.length === 0 && (
                          <p className="text-[11px] text-destructive mt-1">Not yet contacted</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>
      )}

      {canEdit && (
        <AddCardDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          onAdd={(row) => {
            save([row, ...rows]);
            toast.success(`${row.person_name} added to the pipeline.`);
          }}
          leaderNames={leaderNames}
          existingRows={rows}
        />
      )}

      {detail && canEdit && (
        <DetailDialog
          row={detail}
          onOpenChange={(open) => !open && setDetailId(null)}
          onUpdate={(patch) => update(detail.id, patch)}
          onRemove={() => remove(detail.id)}
          leaderNames={leaderNames}
        />
      )}
    </div>
  );
}

function AddCardDialog({
  open,
  onOpenChange,
  onAdd,
  existingRows,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (row: DiscipleshipRow) => void;
  leaderNames: string[];
  existingRows: DiscipleshipRow[];
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState(today());
  const [source, setSource] = useState("Connect card");
  const [interests, setInterests] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const { interests: interestList } = useInterestList();
  const volunteers = useRoster((s) => s.volunteers);
  const match = findIndividual(volunteers, name);
  const cardMatch = existingRows.find((r) => personKey(r.person_name) === personKey(name));

  const submit = () => {
    const trimmed = match?.full_name ?? name.trim().replace(/\s+/g, " ");
    if (!trimmed) {
      toast.error("A name is needed.");
      return;
    }
    if (cardMatch) {
      toast.error(`${cardMatch.person_name} already has a connect card — open that one instead.`);
      return;
    }
    onAdd({
      id: `dc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      person_name: trimmed,
      phone: phone.trim(),
      email: email.trim(),
      date_connected: date,
      source: source.trim(),
      stage: "needs_contact",
      contacted: false,
      contacted_date: "",
      interests,
      interest_done: [],
      assigned_to: "",
      plugged_in_date: "",
      notes,
    });
    onOpenChange(false);
    setName("");
    setPhone("");
    setEmail("");
    setInterests([]);
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New connect card</DialogTitle>
          <DialogDescription>
            Capture who reached out and what they’re interested in. They start in “Needs Contact”.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus />
            {match && (
              <p className="text-xs text-amber-600">
                This person is already an Individual — the card will link to their existing profile.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Phone (WhatsApp)</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 082 123 4567" />
            </div>
            <div className="grid gap-1.5">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Date connected</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Source</Label>
              <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Form, visit, friend…" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Interested in</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {interestList.map((def) => {
                const i = def.name;
                return (
                <label
                  key={i}
                  className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm cursor-pointer hover:bg-accent/50"
                >
                  <Checkbox
                    checked={interests.includes(i)}
                    onCheckedChange={(v) =>
                      setInterests((prev) => (v ? [...prev, i] : prev.filter((x) => x !== i)))
                    }
                  />
                  <span>{interestEmoji(def.emoji, i)} {i}</span>
                </label>
                );
              })}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Anything worth remembering…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>Add to pipeline</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailDialog({
  row,
  onOpenChange,
  onUpdate,
  onRemove,
}: {
  row: DiscipleshipRow;
  onOpenChange: (v: boolean) => void;
  onUpdate: (patch: Partial<DiscipleshipRow>) => void;
  onRemove: () => void;
  leaderNames: string[];
}) {
  const lifeGroups = useRoster((s) => s.lifeGroups);
  const addLifeGroupMember = useRoster((s) => s.addLifeGroupMember);
  const volunteers = useRoster((s) => s.volunteers);
  const addVolunteer = useRoster((s) => s.addVolunteer);
  const updateVolunteer = useRoster((s) => s.updateVolunteer);
  const linked = findIndividual(volunteers, row.person_name);
  const stage = stageOf(row);

  /** Ensures this card has exactly one Individual profile; returns the canonical name. */
  const promote = (announce: boolean): string => {
    const existing = findIndividual(useRoster.getState().volunteers, row.person_name);
    if (existing) {
      const fill: Partial<Volunteer> = {};
      if (!existing.phone && row.phone) fill.phone = row.phone;
      if (!existing.email && row.email) fill.email = row.email;
      if (Object.keys(fill).length) updateVolunteer(existing.id, fill);
      if (existing.full_name !== row.person_name) onUpdate({ person_name: existing.full_name });
      if (announce) toast.success(`Linked to existing profile ${existing.full_name}.`);
      return existing.full_name;
    }
    const name = row.person_name.trim().replace(/\s+/g, " ");
    addVolunteer({
      full_name: name,
      phone: row.phone,
      email: row.email,
      is_volunteer: false,
      serving_areas: [],
      notes: [row.source && `Connected ${row.date_connected} via ${row.source}`, row.notes]
        .filter(Boolean)
        .join(" — "),
    });
    toast.success(`${name} is now an Individual — ready for a Life Group or serving.`);
    return name;
  };
  const waNumber = row.phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  const waText = encodeURIComponent(
    `Hi ${row.person_name.split(" ")[0]}! Just checking in — great to have you with us.`,
  );

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{row.person_name}</DialogTitle>
          <DialogDescription>
            {row.date_connected || "no date"} · {row.source || "connect card"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            {stage === "needs_contact" && !row.contacted && (
              <Button
                size="sm"
                onClick={() => onUpdate({ contacted: true, contacted_date: today(), stage: "follow_up" })}
              >
                <Check className="h-4 w-4" /> Mark contacted
              </Button>
            )}
            {row.phone && (
              <Button size="sm" variant="outline" asChild>
                <a
                  href={`https://wa.me/${waNumber}?text=${waText}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              </Button>
            )}
            {row.email && (
              <Button size="sm" variant="outline" asChild>
                <a href={`mailto:${row.email}`}>
                  <Mail className="h-4 w-4" /> Email
                </a>
              </Button>
            )}
            {row.phone && (
              <Button size="sm" variant="outline" asChild>
                <a href={`tel:${row.phone}`}>
                  <Phone className="h-4 w-4" /> Call
                </a>
              </Button>
            )}
          </div>

          {row.contacted && (
            <p className="text-xs text-muted-foreground">
              First contact done{row.contacted_date ? ` on ${row.contacted_date}` : ""}.
            </p>
          )}

          <div className="rounded-md border bg-muted/40 p-3 flex flex-wrap items-center gap-2 text-sm">
            {linked ? (
              <>
                <UserCheck className="h-4 w-4 text-primary" />
                <span>
                  Linked to Individual profile <strong>{linked.full_name}</strong>
                  {linked.serving_areas.length ? ` · serves in ${linked.serving_areas.join(", ")}` : ""}
                </span>
              </>
            ) : (
              <>
                <span className="text-muted-foreground flex-1">Not yet an Individual.</span>
                <Button size="sm" onClick={() => promote(true)}>
                  <UserCheck className="h-4 w-4" /> Make an Individual
                </Button>
              </>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label className="text-sm font-medium">Stage</Label>
            <Select
              value={stage}
              onValueChange={(v) => {
                const patch: Partial<DiscipleshipRow> = { stage: v };
                if (v === "plugged_in" && !row.plugged_in_date) patch.plugged_in_date = today();
                if (v === "handover" || v === "plugged_in") promote(false);
                onUpdate(patch);
              }}
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(stage === "handover" || stage === "plugged_in") && (
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium">Add to a Life Group</Label>
              <Select
                value=""
                onValueChange={(id) => {
                  const g = lifeGroups.find((x) => x.GroupID === id);
                  if (!g) return;
                  const name = promote(false);
                  if (!g.MembersList.some((m) => personKey(m) === personKey(name))) {
                    addLifeGroupMember(g.GroupID, name);
                  }
                  onUpdate({ assigned_to: g.Leaders ? `${g.GroupName} (${g.Leaders})` : g.GroupName });
                  toast.success(`${name} added to ${g.GroupName}.`);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={lifeGroups.length ? "Choose a Life Group…" : "No Life Groups yet"} />
                </SelectTrigger>
                <SelectContent>
                  {lifeGroups.map((g) => (
                    <SelectItem key={g.GroupID} value={g.GroupID}>
                      {g.GroupName}{g.Leaders ? ` — ${g.Leaders}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Label className="text-sm font-medium mt-1">Handed over to</Label>
              <Input
                value={row.assigned_to}
                onChange={(e) => onUpdate({ assigned_to: e.target.value })}
                placeholder="Leader's name or group…"
              />
            </div>
          )}

          <div className="grid gap-1.5">
            <Label className="text-sm font-medium">Their requests</Label>
            <p className="text-xs text-muted-foreground">Tick each one once it’s been seen to.</p>
            <div className="grid gap-1">
              {row.interests.length === 0 && (
                <p className="text-xs text-muted-foreground">No interests captured.</p>
              )}
              {row.interests.map((i) => {
                const done = row.interest_done.includes(i);
                return (
                  <label
                    key={i}
                    className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm cursor-pointer hover:bg-accent/50"
                  >
                    <Checkbox
                      checked={done}
                      onCheckedChange={(v) =>
                        onUpdate({
                          interest_done: v
                            ? [...row.interest_done, i]
                            : row.interest_done.filter((x) => x !== i),
                        })
                      }
                    />
                    <span className={done ? "line-through text-muted-foreground" : ""}>
                      {INTEREST_ICONS[i] ?? "•"} {i}
                    </span>
                    {i === "Baptism" && !done && (
                      <Badge variant="secondary" className="ml-auto">Baptism list</Badge>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-sm font-medium">Contact details</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={row.phone}
                onChange={(e) => onUpdate({ phone: e.target.value })}
                placeholder="Phone"
              />
              <Input
                value={row.email}
                onChange={(e) => onUpdate({ email: e.target.value })}
                placeholder="Email"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-sm font-medium">Notes</Label>
            <Textarea
              value={row.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              rows={3}
              placeholder="Pastoral notes, follow-up ideas…"
            />
          </div>

          <div className="flex justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                onRemove();
                onOpenChange(false);
              }}
            >
              Remove card
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InterestPools({
  rows,
  canEdit,
  onOpen,
  onMarkAllDone,
}: {
  rows: DiscipleshipRow[];
  canEdit: boolean;
  onOpen: (id: string) => void;
  onMarkAllDone: (interest: string, ids: string[]) => void;
}) {
  const [pool, setPool] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const { interests: configured } = useInterestList();
  const saveInterests = useSaveInterestList();

  const allInterests = useMemo(() => {
    const known = new Set(configured.map((i) => i.name));
    const extra = rows.flatMap((r) => r.interests).filter((i) => !known.has(i));
    return [...configured.map((i) => i.name), ...Array.from(new Set(extra))];
  }, [rows, configured]);
  const emojiOf = (i: string) => interestEmoji(configured.find((c) => c.name === i)?.emoji, i);

  const waitingCount = (i: string) =>
    rows.filter((r) => r.interests.includes(i) && !r.interest_done.includes(i)).length;

  const members = pool
    ? rows.filter(
        (r) => r.interests.includes(pool) && (showDone || !r.interest_done.includes(pool)),
      )
    : [];
  const waiting = members.filter((r) => pool && !r.interest_done.includes(pool));

  const copyNumbers = async () => {
    const nums = members.map((r) => r.phone).filter(Boolean);
    if (nums.length === 0) {
      toast.error("Nobody in this list has a phone number yet.");
      return;
    }
    await navigator.clipboard.writeText(nums.join("\n"));
    toast.success(`Copied ${nums.length} number${nums.length === 1 ? "" : "s"} — paste them into a new WhatsApp group.`);
  };

  const copyList = async () => {
    const text = members.map((r) => `${r.person_name}${r.phone ? ` — ${r.phone}` : ""}`).join("\n");
    await navigator.clipboard.writeText(text);
    toast.success("Copied names and numbers.");
  };

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium mr-1">Interest lists:</span>
        {allInterests.map((i) => {
          const n = waitingCount(i);
          const active = pool === i;
          return (
            <button
              key={i}
              onClick={() => setPool(active ? null : i)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                active ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent/60"
              }`}
            >
              {emojiOf(i)} {i}
              <span className={`rounded-full px-1.5 text-[10px] ${active ? "bg-primary-foreground/20" : "bg-muted"}`}>
                {n}
              </span>
            </button>
          );
        })}
        {canEdit && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setManageOpen(true)}>
            <Settings2 className="h-3.5 w-3.5" /> Manage interests
          </Button>
        )}
      </div>

      {pool && (
        <div className="space-y-3 border-t pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">
              {emojiOf(pool)} {pool} — {waiting.length} still waiting
            </h2>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
              <Checkbox checked={showDone} onCheckedChange={(v) => setShowDone(v === true)} />
              Include people already seen to
            </label>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={copyNumbers} disabled={members.length === 0}>
                <MessageCircle className="h-4 w-4" /> Copy numbers for WhatsApp
              </Button>
              <Button size="sm" variant="outline" onClick={copyList} disabled={members.length === 0}>
                Copy names + numbers
              </Button>
              {canEdit && waiting.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => {
                    onMarkAllDone(pool, waiting.map((r) => r.id));
                    toast.success(`Marked ${waiting.length} as seen to for ${pool}.`);
                  }}
                >
                  <Check className="h-4 w-4" /> Mark all seen to
                </Button>
              )}
            </div>
          </div>
          {members.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nobody is waiting on {pool} right now.</p>
          ) : (
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((r) => {
                const done = r.interest_done.includes(pool);
                const stage = STAGES.find((s) => s.id === stageOf(r));
                return (
                  <button
                    key={r.id}
                    onClick={() => canEdit && onOpen(r.id)}
                    className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm hover:bg-accent/50"
                  >
                    <div className="min-w-0">
                      <p className={`truncate font-medium ${done ? "line-through text-muted-foreground" : ""}`}>
                        {r.person_name}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {r.phone || "no phone"} · since {r.date_connected || "?"}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">{stage?.label}</Badge>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function daysBetween(a: string, b: string): number | null {
  const da = new Date(a), db = new Date(b);
  if (!a || !b || isNaN(da.getTime()) || isNaN(db.getTime())) return null;
  return Math.max(0, Math.round((db.getTime() - da.getTime()) / 86_400_000));
}

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Bar({ label, value, max, suffix }: { label: string; value: number; max: number; suffix: string }) {
  return (
    <div className="grid grid-cols-[9rem_1fr_6rem] items-center gap-2 text-sm">
      <span className="truncate">{label}</span>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      </div>
      <span className="text-xs text-muted-foreground text-right">{suffix}</span>
    </div>
  );
}

function Insights({ rows }: { rows: DiscipleshipRow[] }) {
  const plugged = rows.filter((r) => stageOf(r) === "plugged_in");
  const toPlug = plugged.map((r) => daysBetween(r.date_connected, r.plugged_in_date)).filter((n): n is number => n !== null);
  const toContact = rows.map((r) => (r.contacted ? daysBetween(r.date_connected, r.contacted_date) : null)).filter((n): n is number => n !== null);
  const waitingContact = rows.filter((r) => stageOf(r) === "needs_contact").length;
  const rate = rows.length ? Math.round((plugged.length / rows.length) * 100) : 0;

  const groupStats = (keyOf: (r: DiscipleshipRow) => string[]) => {
    const map = new Map<string, { total: number; plugged: number; days: number[] }>();
    for (const r of rows) {
      for (const k of keyOf(r)) {
        const e = map.get(k) ?? { total: 0, plugged: 0, days: [] };
        e.total++;
        if (stageOf(r) === "plugged_in") {
          e.plugged++;
          const d = daysBetween(r.date_connected, r.plugged_in_date);
          if (d !== null) e.days.push(d);
        }
        map.set(k, e);
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
  };

  const byInterest = groupStats((r) => (r.interests.length ? r.interests : ["No interest ticked"]));
  const bySource = groupStats((r) => [r.source || "Unknown"]);
  const contactBuckets = [
    { label: "Contacted within 2 days", test: (d: number) => d <= 2 },
    { label: "Contacted in 3–7 days", test: (d: number) => d > 2 && d <= 7 },
    { label: "Contacted after a week", test: (d: number) => d > 7 },
  ].map((b) => {
    const group = rows.filter((r) => {
      const d = r.contacted ? daysBetween(r.date_connected, r.contacted_date) : null;
      return d !== null && b.test(d);
    });
    const p = group.filter((r) => stageOf(r) === "plugged_in").length;
    return { label: b.label, total: group.length, rate: group.length ? Math.round((p / group.length) * 100) : 0 };
  });

  const maxInterest = Math.max(1, ...byInterest.map(([, v]) => v.total));
  const maxSource = Math.max(1, ...bySource.map(([, v]) => v.total));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="People in the journey" value={String(rows.length)} hint={`${waitingContact} still need a first message`} />
        <Stat label="Plugged in" value={`${plugged.length} (${rate}%)`} />
        <Stat label="Avg. days to plugged in" value={avg(toPlug)?.toString() ?? "—"} hint={toPlug.length ? `from ${toPlug.length} people` : "no one plugged in yet"} />
        <Stat label="Avg. days to first contact" value={avg(toContact)?.toString() ?? "—"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4 space-y-2.5">
          <h2 className="text-sm font-semibold">What people ask for</h2>
          <p className="text-xs text-muted-foreground">How many asked, and what share of them are plugged in.</p>
          {byInterest.map(([k, v]) => (
            <Bar key={k} label={`${INTEREST_ICONS[k] ?? ""} ${k}`} value={v.total} max={maxInterest}
              suffix={`${v.total} · ${Math.round((v.plugged / v.total) * 100)}% in${avg(v.days) !== null ? ` · ${avg(v.days)}d` : ""}`} />
          ))}
        </div>
        <div className="rounded-xl border bg-card p-4 space-y-2.5">
          <h2 className="text-sm font-semibold">Where people come from</h2>
          <p className="text-xs text-muted-foreground">Source on the connect card, with plugged-in share and average days.</p>
          {bySource.map(([k, v]) => (
            <Bar key={k} label={k} value={v.total} max={maxSource}
              suffix={`${v.total} · ${Math.round((v.plugged / v.total) * 100)}% in${avg(v.days) !== null ? ` · ${avg(v.days)}d` : ""}`} />
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-2.5">
        <h2 className="text-sm font-semibold">Does a quick first message help?</h2>
        <p className="text-xs text-muted-foreground">Plugged-in rate by how fast the first contact happened.</p>
        {contactBuckets.map((b) => (
          <Bar key={b.label} label={b.label} value={b.rate} max={100} suffix={`${b.rate}% of ${b.total}`} />
        ))}
      </div>
    </div>
  );
}
