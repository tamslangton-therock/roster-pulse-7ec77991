import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CalendarX, UserRound, Check } from "lucide-react";
import { toast } from "sonner";
import { useRoster } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BirthdayInput } from "@/components/birthday-input";
import { Calendar } from "@/components/ui/calendar";

export const Route = createFileRoute("/my-roster")({
  validateSearch: (s: Record<string, unknown>) => ({ id: typeof s.id === "string" ? s.id : "" }),
  head: () => ({
    meta: [
      { title: "The Rock Church — My Serving Schedule" },
      { name: "description", content: "Your serving dates, away dates and contact details at The Rock Church." },
      { property: "og:title", content: "The Rock Church — My Serving Schedule" },
      { property: "og:description", content: "See where you're serving and mark the Sundays you're away." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "The Rock Church" },
      { property: "og:image", content: "https://the-rock-roster.lovable.app/share-card.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://the-rock-roster.lovable.app/share-card.jpg" },
    ],
  }),
  component: MyRosterPage,
});

const STORE_KEY = "rock-portal-id";

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmt(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
}

function MyRosterPage() {
  const { id: linkId } = Route.useSearch();
  const { volunteers, assignments, blockouts, dates, ready, error, updateVolunteer, toggleBlockout } = useRoster();
  const [savedId, setSavedId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [pinA, setPinA] = useState("");
  const [pinB, setPinB] = useState("");
  const [pinErr, setPinErr] = useState("");

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
  const hasPin = /^\d{4}$/.test(me.pin ?? "");

  if (!confirmed) {
    const unlock = () => {
      if (hasPin) {
        if (pinA !== me.pin) return setPinErr("Incorrect PIN. Ask a leader if you've forgotten it.");
      } else {
        if (!/^\d{4}$/.test(pinA)) return setPinErr("Please enter 4 digits.");
        if (pinA !== pinB) return setPinErr("The PINs don't match.");
        updateVolunteer(me.id, { pin: pinA });
      }
      localStorage.setItem(STORE_KEY, me.id);
      setSavedId(me.id);
    };
    const pinInput = (v: string, set: (s: string) => void, ph: string) => (
      <Input
        type="password"
        inputMode="numeric"
        maxLength={4}
        placeholder={ph}
        value={v}
        onChange={(e) => { set(e.target.value.replace(/\D/g, "").slice(0, 4)); setPinErr(""); }}
        onKeyDown={(e) => e.key === "Enter" && unlock()}
        className="text-center text-lg tracking-[0.5em]"
      />
    );
    return shell(
      <div className="rounded-xl border bg-card p-6 space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {me.full_name}!</h1>
        <p className="text-sm text-muted-foreground">
          {hasPin ? "Enter your 4-digit PIN to open your schedule." : "Create a 4-digit PIN so only you can open your schedule and details."}
        </p>
        {pinInput(pinA, setPinA, hasPin ? "PIN" : "New PIN")}
        {!hasPin && pinInput(pinB, setPinB, "Confirm PIN")}
        {pinErr && <p className="text-xs text-destructive">{pinErr}</p>}
        <Button className="w-full" onClick={unlock}>
          {hasPin ? "Unlock" : "Save & open my schedule"}
        </Button>
      </div>,
    );
  }

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
        <h2 className="flex items-center gap-2 text-sm font-semibold"><CalendarX className="h-4 w-4" /> Dates I'm away</h2>
        <p className="text-xs text-muted-foreground">Tap any date to block it off. Red dates are blocked — tap again to undo.</p>
        <div className="flex justify-center">
          <Calendar
            mode="single"
            selected={undefined}
            onDayClick={(day: Date) => {
              const iso = toIso(day);
              if (iso < today) return;
              toggleBlockout(me.full_name, iso, "Self-reported");
            }}
            disabled={{ before: new Date(today + "T00:00:00") }}
            modifiers={{ away: (day: Date) => awaySet.has(toIso(day)) }}
            modifiersClassNames={{ away: "!bg-destructive !text-destructive-foreground rounded-md" }}
            className="p-0"
          />
        </div>
        {awaySet.size > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {[...awaySet].filter((d) => d >= today).sort().map((d) => (
              <span key={d} className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">{fmt(d)}</span>
            ))}
          </div>
        )}
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
