import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { z } from "zod";
import { Download, Printer, Users } from "lucide-react";
import { useRoster } from "@/lib/store";
import { ROSTER_SLOTS } from "@/lib/roster-grid";
import { teamColor, resolveSubTeamColor } from "@/lib/person-colors";
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
  const { assignments, dates, loading, error } = useRoster();
  const [isExporting, setIsExporting] = useState(false);

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
    if (raw.length) return raw;
    const now = new Date().toISOString().slice(0, 7);
    const upcoming = monthOptions.filter((m) => m >= now);
    return (upcoming.length ? upcoming : monthOptions).slice(0, 3);
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

  const slots = useMemo(() => {
    const fixed = ROSTER_SLOTS.filter(
      (s) => s.area.toLowerCase() === area.toLowerCase(),
    );
    if (fixed.length) return fixed;
    // Fallback: derive columns from the assignments themselves so teams that
    // aren't in the fixed slot list still render.
    const seen = new Map<string, { area: string; role: string; label: string }>();
    for (const a of assignments) {
      if (a.area.toLowerCase() !== area.toLowerCase()) continue;
      if (!seen.has(a.label)) {
        seen.set(a.label, { area: a.area, role: a.role ?? a.label, label: a.label });
      }
    }
    return Array.from(seen.values()).sort((x, y) => x.label.localeCompare(y.label));
  }, [area, assignments]);


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

  // Sub-team colours (chosen swatch or auto pastel) keyed by slot label + person.
  const subTeams = useRoster((s) => s.subTeams);
  const subTeamColors = useMemo(() => {
    const bySlot = new Map<string, { name: string; color: ReturnType<typeof resolveSubTeamColor> }>();
    const byPerson = new Map<string, { name: string; color: ReturnType<typeof resolveSubTeamColor> }>();
    for (const r of subTeams) {
      const person = r.person_name?.trim();
      if (!person) continue;
      const entry = {
        name: r.sub_team_name,
        color: resolveSubTeamColor(r.serving_area, r.sub_team_name, r.color),
      };
      if (r.slot_label?.trim()) bySlot.set(`${r.slot_label}||${person.toLowerCase()}`, entry);
      if (
        r.serving_area?.trim().toLowerCase() === area.trim().toLowerCase() &&
        !byPerson.has(person.toLowerCase())
      ) {
        byPerson.set(person.toLowerCase(), entry);
      }
    }
    return { bySlot, byPerson };
  }, [subTeams, area]);

  const colorFor = (person: string, slotLabel?: string) => {
    const key = person.trim().toLowerCase();
    const hit =
      (slotLabel ? subTeamColors.bySlot.get(`${slotLabel}||${key}`) : undefined) ??
      subTeamColors.byPerson.get(key);
    return hit?.color ?? teamColor(area);
  };


  const rangeLabel =
    selectedMonths.length > 0
      ? selectedMonths
          .map((m: string) => format(parseISO(`${m}-01`), "MMMM yyyy"))
          .join(" · ")
      : "No months selected";

  const canExport = shownDates.length > 0 && slots.length > 0 && !loading;

  const exportPdf = async () => {
    if (!canExport || isExporting) return;
    setIsExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const margin = 28;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const contentWidth = pageWidth - margin * 2;
      const dateColWidth = 92;
      const roleColWidth = (contentWidth - dateColWidth) / Math.max(slots.length, 1);
      const rowBottom = () => pageHeight - margin - 54;

      const hslToRgb = (hsl: string): [number, number, number] => {
        const match = hsl.match(/hsl\((\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\)/);
        if (!match) return [255, 255, 255];
        const h = Number(match[1]) / 360;
        const s = Number(match[2]) / 100;
        const l = Number(match[3]) / 100;
        const hueToRgb = (p: number, q: number, tIn: number) => {
          let t = tIn;
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1 / 6) return p + (q - p) * 6 * t;
          if (t < 1 / 2) return q;
          if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
          return p;
        };
        if (s === 0) {
          const gray = Math.round(l * 255);
          return [gray, gray, gray];
        }
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        return [
          Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
          Math.round(hueToRgb(p, q, h) * 255),
          Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
        ];
      };

      const setRgb = (rgb: [number, number, number], target: "fill" | "draw" | "text") => {
        if (target === "fill") doc.setFillColor(rgb[0], rgb[1], rgb[2]);
        if (target === "draw") doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
        if (target === "text") doc.setTextColor(rgb[0], rgb[1], rgb[2]);
      };

      const text = (value: string, x: number, y: number, size = 9, style: "normal" | "bold" = "normal") => {
        doc.setFont("helvetica", style);
        doc.setFontSize(size);
        doc.text(value, x, y);
      };

      const drawHeader = () => {
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageWidth, pageHeight, "F");
        doc.setTextColor(24, 31, 42);
        text(`${area} Team Roster`, margin, 42, 16, "bold");
        doc.setTextColor(93, 101, 113);
        text(rangeLabel.replaceAll(" · ", "  ·  "), margin, 60, 10);
      };

      const drawTableHeader = (startY: number) => {
        const headerY = startY + 20;
        doc.setDrawColor(218, 218, 214);
        doc.setLineWidth(0.8);
        doc.line(margin, headerY + 10, pageWidth - margin, headerY + 10);
        doc.setTextColor(24, 31, 42);
        text("Sunday", margin + 6, headerY, 9, "bold");
        slots.forEach((slot, index) => {
          const x = margin + dateColWidth + index * roleColWidth;
          doc.setDrawColor(232, 229, 221);
          doc.line(x, headerY - 18, x, headerY + 10);
          const role = slot.role || slot.area;
          const suffix = slots.filter((item) => item.role === slot.role).length > 1 ? ` ${slot.label.slice(-1)}` : "";
          const lines = doc.splitTextToSize(`${role}${suffix}`, Math.max(roleColWidth - 12, 24));
          doc.setTextColor(24, 31, 42);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.text(lines.slice(0, 2), x + 6, headerY - (lines.length > 1 ? 5 : 0));
        });
        return headerY + 18;
      };

      const newPage = () => {
        doc.addPage("a4", "landscape");
        drawHeader();
        return drawTableHeader(82);
      };

      drawHeader();
      let y = drawTableHeader(82);

      shownDates.forEach((date, rowIndex) => {
        const lineSets = slots.map((slot) => {
          const person = cellMap[date]?.[slot.label] ?? "";
          return person ? doc.splitTextToSize(person, Math.max(roleColWidth - 20, 30)) : ["—"];
        });
        const maxLines = Math.max(1, ...lineSets.map((lines) => lines.length));
        const rowHeight = Math.max(27, maxLines * 9 + 16);
        if (y + rowHeight > rowBottom()) y = newPage();

        if (rowIndex % 2 === 1) {
          doc.setFillColor(250, 249, 247);
          doc.rect(margin, y - 10, contentWidth, rowHeight, "F");
        }
        doc.setDrawColor(232, 229, 221);
        doc.line(margin, y + rowHeight - 10, pageWidth - margin, y + rowHeight - 10);
        doc.setTextColor(24, 31, 42);
        text(format(parseISO(date), "d MMM yyyy"), margin + 6, y + 7, 9, "bold");

        slots.forEach((slot, index) => {
          const x = margin + dateColWidth + index * roleColWidth;
          doc.setDrawColor(232, 229, 221);
          doc.line(x, y - 10, x, y + rowHeight - 10);
          const person = cellMap[date]?.[slot.label] ?? "";
          if (!person) {
            doc.setTextColor(104, 113, 126);
            text("—", x + 8, y + 7, 9);
            return;
          }
          const color = colorFor(person, slot.label);
          const bg = hslToRgb(color.bg);
          const border = hslToRgb(color.border);
          const fg = hslToRgb(color.text);
          const lines = doc.splitTextToSize(person, Math.max(roleColWidth - 20, 30));
          const pillW = Math.min(roleColWidth - 12, Math.max(...lines.map((line: string) => doc.getTextWidth(line))) + 14);
          const pillH = Math.max(16, lines.length * 9 + 6);
          setRgb(bg, "fill");
          setRgb(border, "draw");
          doc.roundedRect(x + 6, y - 3, pillW, pillH, 5, 5, "FD");
          setRgb(fg, "text");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.text(lines, x + 13, y + 7);
        });

        y += rowHeight;
      });

      if (people.length > 0) {
        y += 24;
        if (y > rowBottom()) y = newPage() + 8;
        doc.setTextColor(93, 101, 113);
        text("TEAM MEMBERS", margin, y, 8, "bold");
        y += 16;
        let x = margin;
        people.forEach((person) => {
          const color = colorFor(person);
          const pillW = Math.min(150, doc.getTextWidth(person) + 16);
          if (x + pillW > pageWidth - margin) {
            x = margin;
            y += 22;
          }
          if (y > rowBottom()) {
            y = newPage() + 8;
            x = margin;
          }
          setRgb(hslToRgb(color.bg), "fill");
          setRgb(hslToRgb(color.border), "draw");
          doc.roundedRect(x, y - 11, pillW, 17, 5, 5, "FD");
          setRgb(hslToRgb(color.text), "text");
          text(person, x + 8, y, 8, "bold");
          x += pillW + 6;
        });
      }

      const safeArea = area.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const monthPart = selectedMonths.join("-") || "roster";
      doc.save(`roster-pulse-${safeArea || "team"}-${monthPart}.pdf`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 print:p-0 print:space-y-0">
      <style>{`
        @page { size: A4 landscape; margin: 10mm; }
        @media print {
          html, body { background: #fff !important; width: 100% !important; }
          /* Escape the app shell: hide everything, then reveal only the sheet */
          body * { visibility: hidden !important; }
          .print-sheet, .print-sheet * { visibility: visible !important; }
          .print-sheet {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: #fff !important;
            overflow: visible !important;
          }
          .print-sheet table { width: 100% !important; table-layout: auto; font-size: 10pt; }
          .print-sheet .print-scroll { overflow: visible !important; max-height: none !important; }
          .no-print { display: none !important; }
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
          <div className="flex flex-wrap gap-2">
          <Button onClick={exportPdf} disabled={!canExport || isExporting}>
            <Download className="h-4 w-4 mr-1.5" />
            {isExporting ? "Building PDF…" : "Download PDF"}
          </Button>
          <Button variant="outline" onClick={() => window.print()} disabled={!canExport}>
            <Printer className="h-4 w-4 mr-1.5" />
            Browser Print
          </Button>
          </div>
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

        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Loading roster data from Google Sheets…
          </p>
        ) : error ? (
          <p className="text-sm text-destructive py-8 text-center">
            Could not load roster data: {error}
          </p>
        ) : shownDates.length === 0 || slots.length === 0 ? (
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
                      const c = person ? colorFor(person, s.label) : null;
                      return (
                        <td
                          key={s.label}
                          className="border-b border-l border-border p-1.5 align-middle"
                        >
                          {person && c ? (
                            <span
                              className="inline-block rounded-md border px-2 py-1 text-xs font-medium leading-tight"
                              style={{
                                backgroundColor: c.bg,
                                borderColor: c.border,
                                color: c.text,
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
                    const c = colorFor(p);
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
