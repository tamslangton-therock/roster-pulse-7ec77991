import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Plus, X, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchLifeGroupForm, submitLifeGroupUpdate } from "@/lib/sheets.functions";

export const Route = createFileRoute("/life-group-update")({
  head: () => ({
    meta: [
      { title: "Life Group Update — The Rock Church" },
      { name: "description", content: "Life group leaders: update your meeting details and members in under two minutes." },
      { property: "og:title", content: "Life Group Update — The Rock Church" },
      { property: "og:description", content: "Update your life group's meeting time, address and members." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LifeGroupUpdatePage,
});

type NewPerson = { name: string; phone: string };

function LifeGroupUpdatePage() {
  const load = useServerFn(fetchLifeGroupForm);
  const submit = useServerFn(submitLifeGroupUpdate);
  const { data, isLoading, error } = useQuery({ queryKey: ["life-group-form"], queryFn: () => load(), staleTime: 60_000, refetchOnWindowFocus: false });

  const [groupId, setGroupId] = useState("");
  const [meeting, setMeeting] = useState("");
  const [address, setAddress] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [newPeople, setNewPeople] = useState<NewPerson[]>([]);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState<NewPerson | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const group = data?.groups.find((g) => g.id === groupId);

  const pick = (id: string) => {
    const g = data?.groups.find((x) => x.id === id);
    setGroupId(id);
    setMeeting(g?.meeting ?? "");
    setAddress(g?.address ?? "");
    setMembers(g?.members ?? []);
    setNewPeople([]);
  };

  const taken = useMemo(() => new Set([...members, ...newPeople.map((p) => p.name)].map((n) => n.toLowerCase())), [members, newPeople]);
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2 || !data) return [];
    return data.names.filter((n) => n.toLowerCase().includes(s) && !taken.has(n.toLowerCase())).slice(0, 6);
  }, [q, data, taken]);
  const exact = data?.names.some((n) => n.toLowerCase() === q.trim().toLowerCase());

  const save = async () => {
    if (!groupId) return;
    setSaving(true);
    try {
      await submit({ data: { groupId, meeting, address, members, newPeople } });
      setDone(group?.name ?? "Your group");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save — please try again");
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <Shell>
        <div className="py-16 text-center space-y-3">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-6 w-6" /></div>
          <h2 className="text-xl font-semibold">Thank you!</h2>
          <p className="text-sm text-muted-foreground">{done} has been updated.</p>
          <Button variant="ghost" onClick={() => { setDone(null); setGroupId(""); }}>Update another group</Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {isLoading && <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="py-10 text-center text-sm text-destructive">Couldn't load the groups. Please refresh.</p>}
      {data && (
        <div className="space-y-5">
          <Card title="1. Your life group">
            <select
              value={groupId}
              onChange={(e) => pick(e.target.value)}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-base"
            >
              <option value="">Select your group…</option>
              {data.groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}{g.leaders ? ` — ${g.leaders}` : ""}</option>
              ))}
            </select>
          </Card>

          {group && (
            <>
              <Card title="2. When & where">
                <label className="block space-y-1">
                  <span className="text-xs text-muted-foreground">Meeting day & time</span>
                  <Input value={meeting} onChange={(e) => setMeeting(e.target.value)} placeholder="e.g. Tuesdays 7pm" className="h-11 text-base" />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-muted-foreground">Address</span>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, suburb" className="h-11 text-base" />
                </label>
              </Card>

              <Card title="3. Who's in your group?">
                <p className="text-xs text-muted-foreground">Tap ✕ to remove someone who's left. Start typing a name to add.</p>
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => (
                    <Chip key={m} label={m} onRemove={() => setMembers((xs) => xs.filter((x) => x !== m))} />
                  ))}
                  {newPeople.map((p) => (
                    <Chip key={p.name} label={p.name} tag="new" onRemove={() => setNewPeople((xs) => xs.filter((x) => x.name !== p.name))} />
                  ))}
                  {members.length + newPeople.length === 0 && <span className="text-sm text-muted-foreground">No members yet</span>}
                </div>

                {adding ? (
                  <div className="space-y-2 rounded-md border border-border p-3">
                    <p className="text-sm font-medium">New person</p>
                    <Input value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} placeholder="Full name" className="h-11 text-base" />
                    <Input value={adding.phone} onChange={(e) => setAdding({ ...adding, phone: e.target.value })} placeholder="Cell number (optional)" inputMode="tel" className="h-11 text-base" />
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        disabled={adding.name.trim().split(/\s+/).length < 2 || taken.has(adding.name.trim().toLowerCase())}
                        onClick={() => { setNewPeople((xs) => [...xs, { name: adding.name.trim(), phone: adding.phone.trim() }]); setAdding(null); setQ(""); }}
                      >Add</Button>
                      <Button variant="ghost" onClick={() => setAdding(null)}>Cancel</Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Please use their full name (first and surname).</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a name…" className="h-11 text-base" />
                    {q.trim().length >= 2 && (
                      <div className="overflow-hidden rounded-md border border-border">
                        {matches.map((n) => (
                          <button key={n} type="button" className="block w-full px-3 py-2.5 text-left text-sm hover:bg-muted" onClick={() => { setMembers((xs) => [...xs, n]); setQ(""); }}>
                            {n}
                          </button>
                        ))}
                        {!exact && (
                          <button type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-primary hover:bg-muted" onClick={() => setAdding({ name: q.trim(), phone: "" })}>
                            <Plus className="h-4 w-4" /> Add new person: "{q.trim()}"
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Card>

              <Button className="h-12 w-full text-base" disabled={saving} onClick={save}>
                {saving ? "Saving…" : "Save group update"}
              </Button>
            </>
          )}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-muted"><Users className="h-5 w-5" /></div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">The Rock Church</p>
            <h1 className="text-lg font-semibold">Life Group Update</h1>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}

function Chip({ label, tag, onRemove }: { label: string; tag?: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted py-1 pl-3 pr-1 text-sm">
      {label}
      {tag && <span className="text-[10px] uppercase text-primary">{tag}</span>}
      <button type="button" aria-label={`Remove ${label}`} onClick={onRemove} className="grid h-6 w-6 place-items-center rounded-full hover:bg-background">
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}
