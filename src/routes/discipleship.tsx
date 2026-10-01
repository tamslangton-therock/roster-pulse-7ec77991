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

const INTERESTS = [
  "Life Groups",
  "New Partners Dinner",
  "Alpha",
  "Baptism",
  "More about God",
  "Serving",
] as const;

const INTEREST_ICONS: Record<string, string> = {
  "Life Groups": "👥",
  "New Partners Dinner": "🍽️",
  Alpha: "❓",
  Baptism: "🌊",
  "More about God": "✝️",
  Serving: "🤝",
};

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

      {canEdit && (
        <AddCardDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          onAdd={(row) => {
            save([row, ...rows]);
            toast.success(`${row.person_name} added to the pipeline.`);
          }}
          leaderNames={leaderNames}
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
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (row: DiscipleshipRow) => void;
  leaderNames: string[];
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState(today());
  const [source, setSource] = useState("Connect card");
  const [interests, setInterests] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("A name is needed.");
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
              {INTERESTS.map((i) => (
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
                  <span>{INTEREST_ICONS[i]} {i}</span>
                </label>
              ))}
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
  const stage = stageOf(row);
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

          <div className="grid gap-1.5">
            <Label className="text-sm font-medium">Stage</Label>
            <Select
              value={stage}
              onValueChange={(v) => {
                const patch: Partial<DiscipleshipRow> = { stage: v };
                if (v === "plugged_in" && !row.plugged_in_date) patch.plugged_in_date = today();
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

          {stage === "handover" && (
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium">Handed over to</Label>
              <Input
                value={row.assigned_to}
                onChange={(e) => onUpdate({ assigned_to: e.target.value })}
                placeholder="Leader's name…"
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

  const allInterests = useMemo(() => {
    const extra = rows.flatMap((r) => r.interests).filter((i) => !(INTERESTS as readonly string[]).includes(i));
    return [...INTERESTS, ...Array.from(new Set(extra))];
  }, [rows]);

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
              {INTEREST_ICONS[i] ?? "•"} {i}
              <span className={`rounded-full px-1.5 text-[10px] ${active ? "bg-primary-foreground/20" : "bg-muted"}`}>
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {pool && (
        <div className="space-y-3 border-t pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">
              {INTEREST_ICONS[pool] ?? "•"} {pool} — {waiting.length} still waiting
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
