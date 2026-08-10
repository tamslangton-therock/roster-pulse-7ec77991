import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Plus, Printer, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";


export interface DocRoleRow {
  id: string;
  role: string;
  names: string;
  comment: string;
}

export interface TaskRow {
  id: string;
  task: string;
  assigned: string;
  done: boolean;
}

const HUDDLE_STEPS: Array<{ simple: string; detail: string }> = [
  { simple: "Gather", detail: "Everyone in the auditorium 60 minutes before the service starts." },
  { simple: "Welcome", detail: "Host welcomes the team, introduces any new or visiting servers." },
  { simple: "Vision", detail: "Short reminder of why we serve — people meeting Jesus today." },
  { simple: "Run sheet", detail: "Walk the service order: worship, notices, message, response." },
  { simple: "Roles", detail: "Confirm each area knows their position and hand-off points." },
  { simple: "Notices", detail: "Any announcements, events or changes for this Sunday." },
  { simple: "Pray", detail: "Pray together for the service, the guests and the team." },
  { simple: "Positions", detail: "Team in position 30 minutes before doors open." },
];

const HOST_CHECKLIST: Array<{ group: string; items: string[] }> = [
  {
    group: "Pre-Service",
    items: [
      "Unlock doors and switch on foyer lights",
      "Check auditorium seating and tidy chairs",
      "Communion table set and covered",
      "Welcome desk stocked with connect cards and pens",
      "Confirm all hosting positions are filled",
    ],
  },
  {
    group: "Service Starts",
    items: [
      "Doors closed once worship begins",
      "Late arrivals seated at the back",
      "Count attendance and record on the sheet",
      "Communion servers in position before the response",
    ],
  },
  {
    group: "In-Between Services",
    items: [
      "Reset chairs and clear cups",
      "Restock communion elements",
      "Empty foyer bins",
      "Brief the second-service hosts",
    ],
  },
];

const DEFAULT_HOST_TASKS = [
  "Cut Communion Bread",
  "Pour Communion Juice",
  "Left Front Communion",
  "Right Front Communion",
  "Back Communion",
  "Offering Bags",
  "Door Greeting",
  "Attendance Count",
];

const uid = () => Math.random().toString(36).slice(2, 9);

interface Props {
  date: string;
  areas: string[];
  /** area -> [{ role, names }] rows pulled from the live roster */
  roleRows: Array<{ role: string; names: string }>;
  hostNames: string[];
  onClose: () => void;
}

export function SundayDocs({ date, areas, roleRows, hostNames, onClose }: Props) {
  const [thickBorders, setThickBorders] = useState(false);
  const [rows, setRows] = useState<DocRoleRow[]>(() =>
    roleRows.map((r) => ({ id: uid(), role: r.role, names: r.names, comment: "" })),
  );
  const [banner, setBanner] = useState(
    "Reminder: please arrive 60 minutes before the service and check in with your team leader.",
  );
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [tasks, setTasks] = useState<TaskRow[]>(() =>
    DEFAULT_HOST_TASKS.map((task, i) => ({
      id: uid(),
      task,
      assigned: hostNames[i] ?? "",
      done: false,
    })),
  );
  const [taskNote, setTaskNote] = useState(
    "Any swaps on the day must be confirmed with the host before the service starts.",
  );

  const dateLabel = useMemo(
    () => (date ? format(parseISO(date), "EEEE d MMMM yyyy") : "Sunday"),
    [date],
  );

  const border = thickBorders ? "border-2" : "border";

  const doPrint = () => {
    document.body.setAttribute("data-print-target", "docs");
    window.print();
    window.setTimeout(() => document.body.removeAttribute("data-print-target"), 500);
  };

  const cellClass =
    "w-full bg-transparent outline-none focus:bg-accent/40 rounded px-1 py-0.5 text-sm";

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-background/95 backdrop-blur-sm print:static print:bg-transparent print:overflow-visible">
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b bg-card px-4 py-3 shadow-sm">
        <div className="mr-auto">
          <p className="font-semibold">Sunday Docs — {dateLabel}</p>
          <p className="text-xs text-muted-foreground">
            {areas.length ? areas.join(" · ") : "No teams selected"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="thick" checked={thickBorders} onCheckedChange={setThickBorders} />
          <Label htmlFor="thick" className="text-xs">
            Bold borders
          </Label>
        </div>
        <Button onClick={doPrint}>
          <Printer className="mr-1.5 h-4 w-4" />
          Print / Save as PDF
        </Button>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close preview">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="docs-sheet mx-auto max-w-5xl space-y-8 p-6 print:max-w-none print:p-0">
        {/* Module 1 */}
        <section className="doc-module rounded-lg border bg-card p-5 print:rounded-none print:border-0 print:bg-white print:p-0">
          <DocHeader title="Team Huddle Overview" subtitle={dateLabel} />
          <table className={cn("w-full border-collapse", border, "border-doc-line")}>
            <thead>
              <tr className="bg-doc-header text-doc-header-foreground">
                <th className={cn(border, "border-doc-line p-2 text-left text-xs font-bold uppercase w-[26%]")}>Role</th>
                <th className={cn(border, "border-doc-line p-2 text-left text-xs font-bold uppercase w-[38%]")}>Name(s)</th>
                <th className={cn(border, "border-doc-line p-2 text-left text-xs font-bold uppercase")}>Comment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className={cn(border, "border-doc-line p-1")}>
                    <input
                      className={cn(cellClass, "font-medium")}
                      value={r.role}
                      onChange={(e) =>
                        setRows((p) => p.map((x) => (x.id === r.id ? { ...x, role: e.target.value } : x)))
                      }
                    />
                  </td>
                  <td className={cn(border, "border-doc-line p-1")}>
                    <input
                      className={cellClass}
                      value={r.names}
                      onChange={(e) =>
                        setRows((p) => p.map((x) => (x.id === r.id ? { ...x, names: e.target.value } : x)))
                      }
                    />
                  </td>
                  <td className={cn(border, "border-doc-line p-1")}>
                    <div className="flex items-center gap-1">
                      <input
                        className={cellClass}
                        value={r.comment}
                        placeholder="—"
                        onChange={(e) =>
                          setRows((p) =>
                            p.map((x) => (x.id === r.id ? { ...x, comment: e.target.value } : x)),
                          )
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="no-print h-6 w-6 shrink-0"
                        onClick={() => setRows((p) => p.filter((x) => x.id !== r.id))}
                        aria-label="Remove row"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button
            variant="outline"
            size="sm"
            className="no-print mt-2"
            onClick={() => setRows((p) => [...p, { id: uid(), role: "", names: "", comment: "" }])}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add row
          </Button>
          <textarea
            className="mt-4 w-full resize-none rounded-md border border-doc-note-border bg-doc-note p-3 text-sm font-medium text-doc-note-foreground outline-none"
            rows={2}
            value={banner}
            onChange={(e) => setBanner(e.target.value)}
          />
        </section>

        {/* Module 2 */}
        <section className="doc-module rounded-lg border bg-card p-5 print:rounded-none print:border-0 print:bg-white print:p-0">
          <DocHeader title="Team Huddle Briefing & Host Tasks" subtitle={dateLabel} />
          <table className={cn("w-full border-collapse", border, "border-doc-line")}>
            <thead>
              <tr className="bg-doc-header text-doc-header-foreground">
                <th className={cn(border, "border-doc-line p-2 text-left text-xs font-bold uppercase w-[24%]")}>Simple</th>
                <th className={cn(border, "border-doc-line p-2 text-left text-xs font-bold uppercase")}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {HUDDLE_STEPS.map((s) => (
                <tr key={s.simple}>
                  <td className={cn(border, "border-doc-line p-2 text-sm font-semibold")}>{s.simple}</td>
                  <td className={cn(border, "border-doc-line p-2 text-sm")}>{s.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 grid gap-4 sm:grid-cols-3 print:grid-cols-3">
            {HOST_CHECKLIST.map((group) => (
              <div key={group.group} className={cn("rounded-md p-3", border, "border-doc-line")}>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-doc-header">
                  {group.group}
                </p>
                <ul className="space-y-1.5">
                  {group.items.map((item) => {
                    const key = `${group.group}:${item}`;
                    return (
                      <li key={key} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--doc-header)]"
                          checked={!!checked[key]}
                          onChange={(e) =>
                            setChecked((p) => ({ ...p, [key]: e.target.checked }))
                          }
                        />
                        <span>{item}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Module 3 */}
        <section className="doc-module rounded-lg border bg-card p-5 print:rounded-none print:border-0 print:bg-white print:p-0">
          <DocHeader title="Hosting Task Assignments" subtitle={dateLabel} />
          <table className={cn("w-full border-collapse", border, "border-doc-line")}>
            <thead>
              <tr className="bg-doc-header text-doc-header-foreground">
                <th className={cn(border, "border-doc-line p-2 text-left text-xs font-bold uppercase w-[45%]")}>Task</th>
                <th className={cn(border, "border-doc-line p-2 text-left text-xs font-bold uppercase")}>Assigned to</th>
                <th className={cn(border, "border-doc-line p-2 text-center text-xs font-bold uppercase w-[90px]")}>Status</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td className={cn(border, "border-doc-line p-1")}>
                    <input
                      className={cn(cellClass, "font-medium")}
                      value={t.task}
                      onChange={(e) =>
                        setTasks((p) => p.map((x) => (x.id === t.id ? { ...x, task: e.target.value } : x)))
                      }
                    />
                  </td>
                  <td className={cn(border, "border-doc-line p-1")}>
                    <div className="flex items-center gap-1">
                      <input
                        className={cellClass}
                        list="sunday-docs-hosts"
                        placeholder="—"
                        value={t.assigned}
                        onChange={(e) =>
                          setTasks((p) =>
                            p.map((x) => (x.id === t.id ? { ...x, assigned: e.target.value } : x)),
                          )
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="no-print h-6 w-6 shrink-0"
                        onClick={() => setTasks((p) => p.filter((x) => x.id !== t.id))}
                        aria-label="Remove task"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                  <td className={cn(border, "border-doc-line p-1 text-center")}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--doc-header)]"
                      checked={t.done}
                      onChange={(e) =>
                        setTasks((p) => p.map((x) => (x.id === t.id ? { ...x, done: e.target.checked } : x)))
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="sunday-docs-hosts">
            {hostNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <Button
            variant="outline"
            size="sm"
            className="no-print mt-2"
            onClick={() => setTasks((p) => [...p, { id: uid(), task: "", assigned: "", done: false }])}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add task
          </Button>
          <textarea
            className="mt-4 w-full resize-none rounded-md border border-doc-note-border bg-doc-note p-3 text-sm font-medium text-doc-note-foreground outline-none"
            rows={2}
            value={taskNote}
            onChange={(e) => setTaskNote(e.target.value)}
          />
        </section>

      </div>
    </div>
  );
}

function DocHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between rounded-t-md bg-doc-header px-3 py-2 text-doc-header-foreground">
      <h3 className="text-base font-bold uppercase tracking-wide">{title}</h3>
      <span className="text-xs font-medium opacity-90">{subtitle}</span>
    </div>
  );
}
