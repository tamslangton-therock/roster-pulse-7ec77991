import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { z } from "zod";
import { Printer, Users } from "lucide-react";
import { useRoster } from "@/lib/store";
import { ROSTER_SLOTS } from "@/lib/roster-grid";
import { personColor } from "@/lib/person-colors";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const printSearchSchema = z.object({
  area: z.string().optional().default(""),
  months: z.string().optional().default(""),
});

export const Route = createFileRoute("/print")({
  validateSearch: (search) => printSearchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Team Roster Print — Roster Pulse" },
      {
        name: "description",
        content:
          "Generate a colour-coded, print-ready Sunday roster for a single serving team across selected months.",
      },
      { property: "og:title", content: "Team Roster Print — Roster Pulse" },
      {
        property: "og:description",
        content: "Colour-coded, print-ready Sunday rosters for each serving team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrintRosterPage,
});

function PrintRosterPage() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const { assignments, dates } = useRoster();

  const areas = useMemo(() => {
    const set = new Set<string>(ROSTER_SLOTS.map((s) => s.area));
    for (const a of assignments) if (a.area) set.add(a.area);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [assignments]);

  const area = String(search.area || "") || areas[0] || "";

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    for (const d of dates) set.add(d.slice(0, 7));
    return Array.from(set).sort();
  }, [dates]);

  const selectedMonths = useMemo(() => {
    const raw = String(search.months || "").split(",").filter(Boolean) as string[];
    return raw.length ? raw : monthOptions.slice(0, 3);
  }, [search.months, monthOptions]);

  const toggleMonth = (m: string) => {
    const next = selectedMonths.includes(m)
      ? selectedMonths.filter((x: string) => x !== m)
      : [...selectedMonths, m].sort();
    navigate({
      search: (prev: Record<string, unknown>) => ({ ...prev, months: next.join(",") }),
      replace: true,
    });
  };

  const slots = useMemo(
    () => ROSTER_SLOTS.filter((s) => s.area.toLowerCase() === area.toLowerCase()),
    [area],
  );

  const shownDates = useMemo(
    () => dates.filter((d) => selectedMonths.includes(d.slice(0, 7))).sort(),
    [dates, selectedMonths],
  );

  // date -> label -> person
  const cellMap = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    for (const a of assignments) {
      if (a.area.toLowerCase() !== area.toLowerCase()) continue;
      (map[a.date] ??= {})[a.label] = a.person_name;
    }
    return map;
  }, [assignments, area]);

  const people = useMemo(() => {
    const set = new Set<string>();
    for (const d of shownDates) {
      for (const s of slots) {
        const n = cellMap[d]?.[s.label];
        if (n) set.add(n);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [shownDates, slots, cellMap]);

  const rangeLabel =
    selectedMonths.length > 0
      ? selectedMonths
          .map((m: string) => format(parseISO(`${m}-01`), "MMMM yyyy"))
          .join(" · ")
      : "No months selected";

  return (
    <div className="p-6 space-y-6 print:p-0 print:space-y-0">
      <style>{`
        @page { size: A4 landscape; margin: 12mm; }
        @media print {
          html, body { background: #fff !important; }
          .no-print, header, nav, [data-sidebar] { display: none !important; }
          .print-sheet { box-shadow: none !important; border: none !important; padding: 0 !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          thead { display: table-header-group; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* Controls */}
      <div className="no-print rounded-xl border bg-card p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Team Roster Print</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Pick a serving team and the months you want, then print or save as PDF.
            </p>
          </div>
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1.5" />
            Print / Save PDF
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <Select
              value={area}
              onValueChange={(v) =>
                navigate({
                  search: (prev: Record<string, unknown>) => ({ ...prev, area: v }),
                  replace: true,
                })
              }
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                {areas.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {monthOptions.map((m) => {
              const active = selectedMonths.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMonth(m)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  {format(parseISO(`${m}-01`), "MMM yyyy")}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Printable sheet */}
      <div className="print-sheet rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-xl font-semibold tracking-tight">{area} Team Roster</h2>
          <p className="text-sm text-muted-foreground">{rangeLabel}</p>
        </div>

        {shownDates.length === 0 || slots.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nothing to show — choose a team and at least one month.
          </p>
        ) : (
          <>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b-2 border-border p-2 text-left font-semibold w-[130px] align-bottom">
                    Sunday
                  </th>
                  {slots.map((s) => (
                    <th
                      key={s.label}
                      className="border-b-2 border-l border-border p-2 text-left font-semibold align-bottom whitespace-nowrap"
                    >
                      {s.role || s.area}
                      {slots.filter((x) => x.role === s.role).length > 1 && (
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          {s.label.slice(-1)}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shownDates.map((d, i) => (
                  <tr key={d} className={i % 2 === 1 ? "bg-muted/30" : undefined}>
                    <td className="border-b border-border p-2 font-medium whitespace-nowrap align-middle">
                      {format(parseISO(d), "d MMM yyyy")}
                    </td>
                    {slots.map((s) => {
                      const person = cellMap[d]?.[s.label] ?? "";
                      const c = person ? personColor(person) : null;
                      return (
                        <td
                          key={s.label}
                          className="border-b border-l border-border p-1.5 align-middle"
                        >
                          {person ? (
                            <span
                              className="inline-block rounded-md border px-2 py-1 text-xs font-medium leading-tight"
                              style={{
                                backgroundColor: c!.bg,
                                borderColor: c!.border,
                                color: c!.text,
                              }}
                            >
                              {person}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {people.length > 0 && (
              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Team members
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {people.map((p) => {
                    const c = personColor(p);
                    return (
                      <span
                        key={p}
                        className="inline-block rounded-md border px-2 py-1 text-xs font-medium"
                        style={{ backgroundColor: c.bg, borderColor: c.border, color: c.text }}
                      >
                        {p}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
