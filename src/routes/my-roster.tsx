import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CalendarX, UserRound, Check } from "lucide-react";
import { toast } from "sonner";
import { useRoster } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BirthdayInput } from "@/components/birthday-input";

export const Route = createFileRoute("/my-roster")({
  validateSearch: (s: Record<string, unknown>) => ({ id: typeof s.id === "string" ? s.id : "" }),
  head: () => ({
    meta: [
      { title: "My Serving — The Rock Church" },
      { name: "description", content: "Your serving dates, away dates and contact details at The Rock Church." },
      { property: "og:title", content: "My Serving — The Rock Church" },
      { property: "og:description", content: "See where you're serving and mark the Sundays you're away." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyRosterPage,
});

const STORE_KEY = "rock-portal-id";

function fmt(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
}

function MyRosterPage() {
  const { id: linkId } = Route.useSearch();
  const { volunteers, assignments, blockouts, dates, ready, error, updateVolunteer, toggleBlockout } = useRoster();
  const [savedId, setSavedId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setSavedId(localStorage.getItem(STORE_KEY));
    setChecked(true);
  }, []);

  const id = linkId || savedId || "";
  const me = volunteers.find((v) => v.id === id);
  const confirmed = Boolean(me && savedId === me.id);

  const today = new Date().toISOString().slice(0, 10);
  const key = (me?.full_name || "").trim().toLowerCase();

  const myServing = useMemo(
    () =>
      assignments
        .filter((a) => a.date >= today && a.person_name.trim().toLowerCase() === key && key)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [assignments, key, today],
  );
  const upcomingDates = useMemo(() => dates.filter((d) => d >= today).slice(0, 16), [dates, today]);
  const awaySet = useMemo(
    () => new Set(blockouts.filter((b) => b.person_name.trim().toLowerCase() === key).map((b) => b.date)),
    [blockouts, key],
  );

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthday, setBirthday] = useState("");
  useEffect(() => {
    if (me) {
      setPhone(me.phone ?? "");
      setEmail(me.email ?? "");
      setBirthday(me.birthday ?? "");
    }
  }, [me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const shell = (body: React.ReactNode) => (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-4 py-8 space-y-5">
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">The Rock Church</div>
        {body}
      </div>
    </div>
  );

  if (!checked || (!ready && !error)) return shell(<p className="text-sm text-muted-foreground">Loading your schedule…</p>);
  if (error) return shell(<p className="text-sm text-destructive">Couldn't load right now. Please try again in a minute.</p>);
  if (!me || me.is_volunteer === false)
    return shell(
      <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        This link isn't recognised. Please ask your team leader to send you a fresh link.
      </div>,
    );

  const first = me.full_name.split(/\s+/)[0];

  if (!confirmed)
    return shell(
      <div className="rounded-xl border bg-card p-6 space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {me.full_name}!</h1>
        <p className="text-sm text-muted-foreground">Tap below to open your personal serving schedule & details.</p>
        <Button
          className="w-full"
          onClick={() => {
            localStorage.setItem(STORE_KEY, me.id);
            setSavedId(me.id);
          }}
        >
          Continue as {first}
        </Button>
      </div>,
    );

  const saveDetails = () => {
    updateVolunteer(me.id, { phone: phone.trim(), email: email.trim(), birthday });
    toast.success("Details saved");
  };

  return shell(
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Hi {first} 👋</h1>

      <section className="rounded-xl border bg-card p-5 space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><CalendarDays className="h-4 w-4" /> My serving dates</h2>
        {myServing.length === 0 ? (
          <p className="text-sm text-muted-foreground">You're not rostered on any upcoming Sundays yet.</p>
        ) : (
          <ul className="divide-y">
            {myServing.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium">{fmt(a.date)}</span>
                <span className="text-muted-foreground text-right">{a.area}{a.role && a.role !== a.area ? ` · ${a.role}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card p-5 space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><CalendarX className="h-4 w-4" /> Sundays I'm away</h2>
        <p className="text-xs text-muted-foreground">Tap a date to mark yourself away. Tap again to undo.</p>
        <div className="grid grid-cols-3 gap-2">
          {upcomingDates.map((d) => {
            const away = awaySet.has(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleBlockout(me.full_name, d, "Self-reported")}
                className={
                  "rounded-lg border px-2 py-2 text-xs transition-colors " +
                  (away ? "border-destructive/40 bg-destructive/10 text-destructive" : "hover:bg-accent")
                }
              >
                {away && <Check className="mx-auto mb-0.5 h-3 w-3" />}
                {fmt(d)}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5 space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><UserRound className="h-4 w-4" /> My details</h2>
        <label className="block space-y-1 text-xs text-muted-foreground">Cell number
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        </label>
        <label className="block space-y-1 text-xs text-muted-foreground">Email
          <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        </label>
        <div className="space-y-1 text-xs text-muted-foreground">Birthday
          <BirthdayInput value={birthday} onChange={setBirthday} />
        </div>
        <Button className="w-full" onClick={saveDetails}>Save details</Button>
      </section>
    </>,
  );
}
