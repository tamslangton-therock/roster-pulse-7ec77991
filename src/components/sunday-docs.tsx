import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Plus, Printer, RotateCcw, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { uid, type DocSection, type DocTemplateItem } from "@/lib/doc-template";

interface Props {
  date: string;
  areas: string[];
  /** Template draft (layout + base text) that names get filled into. */
  template: DocSection[];
  /** area/role -> names pulled from the live roster for the chosen date */
  roleRows: Array<{ role: string; names: string }>;
  hostNames: string[];
  onClose: () => void;
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Print-only mirror of an editable field. Text inputs inside flex rows collapse
 * to zero width when printing, so the on-screen input is hidden and this plain
 * text is shown instead on paper.
 */
function PrintText({ value, className }: { value: string; className?: string }) {
  return (
    <span
      className={cn(
        "hidden px-1 py-0.5 text-sm break-words whitespace-pre-wrap print:block",
        className,
      )}
    >
      {value || "\u00A0"}
    </span>
  );
}

/** Fill the draft with the people rostered on this Sunday. */
function generate(
  template: DocSection[],
  roleRows: Array<{ role: string; names: string }>,
  hostNames: string[],
): DocSection[] {
  const byRole = new Map(roleRows.map((r) => [norm(r.role), r.names]));
  let hostIndex = 0;
  return template.map((section) => {
    if (section.type === "roles") {
      const items: DocTemplateItem[] =
        section.items.length > 0
          ? section.items.map((it) => ({
              ...it,
              id: uid(),
              b: byRole.get(norm(it.a)) ?? it.b,
            }))
          : roleRows.map((r) => ({ id: uid(), a: r.role, b: r.names, c: "" }));
      return { ...section, items };
    }
    if (section.type === "tasks") {
      return {
        ...section,
        items: section.items.map((it) => ({
          ...it,
          id: uid(),
          b: it.b || hostNames[hostIndex++] || "",
        })),
      };
    }
    return { ...section, items: section.items.map((it) => ({ ...it, id: uid() })) };
  });
}

const draftKey = (date: string) => `roster-pulse:sunday-doc-draft:${date || "unset"}`;

interface SavedDraft {
  savedAt: string;
  sections: DocSection[];
  checked: Record<string, boolean>;
}

function readDraft(date: string): SavedDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftKey(date));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedDraft;
    return Array.isArray(parsed?.sections) ? parsed : null;
  } catch {
    return null;
  }
}

export function SundayDocs({ date, areas, template, roleRows, hostNames, onClose }: Props) {
  const [thickBorders, setThickBorders] = useState(false);
  const initialDraft = useMemo(() => readDraft(date), [date]);
  const [sections, setSections] = useState<DocSection[]>(
    () => initialDraft?.sections ?? generate(template, roleRows, hostNames),
  );
  const [checked, setChecked] = useState<Record<string, boolean>>(
    () => initialDraft?.checked ?? {},
  );
  const [savedAt, setSavedAt] = useState<string | null>(initialDraft?.savedAt ?? null);
  const [confirmReset, setConfirmReset] = useState(false);

  const saveDraft = () => {
    const payload: SavedDraft = { savedAt: new Date().toISOString(), sections, checked };
    try {
      window.localStorage.setItem(draftKey(date), JSON.stringify(payload));
      setSavedAt(payload.savedAt);
      toast.success("Draft saved — reopen this Sunday to keep editing");
    } catch {
      toast.error("Could not save the draft on this device");
    }
  };

  const resetDraft = () => {
    window.localStorage.removeItem(draftKey(date));
    setSections(generate(template, roleRows, hostNames));
    setChecked({});
    setSavedAt(null);
    setConfirmReset(false);
    toast.success("Reset to the default template");
  };

  const dateLabel = useMemo(
    () => (date ? format(parseISO(date), "EEEE d MMMM yyyy") : "Sunday"),
    [date],
  );

  const border = thickBorders ? "border-2" : "border";
  const cellClass =
    "w-full bg-transparent outline-none focus:bg-accent/40 rounded px-1 py-0.5 text-sm";

  const doPrint = () => {
    document.body.setAttribute("data-print-target", "docs");
    window.print();
    window.setTimeout(() => document.body.removeAttribute("data-print-target"), 500);
  };

  const patch = (sid: string, itemId: string, key: "a" | "b" | "c", value: string) =>
    setSections((prev) =>
      prev.map((s) =>
        s.id === sid
          ? {
              ...s,
              items: s.items.map((it) => (it.id === itemId ? { ...it, [key]: value } : it)),
            }
          : s,
      ),
    );

  const removeItem = (sid: string, itemId: string) =>
    setSections((prev) =>
      prev.map((s) =>
        s.id === sid ? { ...s, items: s.items.filter((it) => it.id !== itemId) } : s,
      ),
    );

  const addItem = (sid: string, a = "", c = "") =>
    setSections((prev) =>
      prev.map((s) =>
        s.id === sid ? { ...s, items: [...s.items, { id: uid(), a, b: "", c }] } : s,
      ),
    );

  const RemoveBtn = ({ onClick, label }: { onClick: () => void; label: string }) => (
    <Button
      variant="ghost"
      size="icon"
      className="no-print h-6 w-6 shrink-0"
      onClick={onClick}
      aria-label={label}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-background/95 backdrop-blur-sm print:static print:bg-transparent print:overflow-visible">
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b bg-card px-4 py-3 shadow-sm">
        <div className="mr-auto">
          <p className="font-semibold">Sunday Docs — {dateLabel}</p>
          <p className="text-xs text-muted-foreground">
            {areas.length ? areas.join(" · ") : "No teams selected"}
            {savedAt
              ? ` · Draft saved ${format(new Date(savedAt), "d MMM HH:mm")}`
              : " · Not saved yet"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="thick" checked={thickBorders} onCheckedChange={setThickBorders} />
          <Label htmlFor="thick" className="text-xs">
            Bold borders
          </Label>
        </div>
        <Button variant="outline" onClick={saveDraft}>
          <Save className="mr-1.5 h-4 w-4" />
          Save as draft
        </Button>
        <Button
          variant={confirmReset ? "destructive" : "outline"}
          onClick={() => (confirmReset ? resetDraft() : setConfirmReset(true))}
        >
          <RotateCcw className="mr-1.5 h-4 w-4" />
          {confirmReset ? "Confirm reset" : "Reset to default"}
        </Button>
        <Button onClick={doPrint}>
          <Printer className="mr-1.5 h-4 w-4" />
          Print / Save as PDF
        </Button>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close preview">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="docs-sheet mx-auto max-w-5xl space-y-8 p-6 print:max-w-none print:p-0">
        {sections.map((section) => {
          if (section.type === "note") {
            return (
              <section
                key={section.id}
                className={cn("doc-module", section.pageBreak && "doc-page-break")}
              >
                {section.items.map((it) => (
                  <textarea
                    key={it.id}
                    className="w-full resize-none rounded-md border border-doc-note-border bg-doc-note p-3 text-sm font-medium text-doc-note-foreground outline-none"
                    rows={2}
                    value={it.a}
                    onChange={(e) => patch(section.id, it.id, "a", e.target.value)}
                  />
                ))}
              </section>
            );
          }

          return (
            <section
              key={section.id}
              className={cn(
                "doc-module rounded-lg border bg-card p-5 print:rounded-none print:border-0 print:bg-white print:p-0",
                section.pageBreak && "doc-page-break",
              )}
            >
              <DocHeader title={section.title || "Section"} subtitle={dateLabel} />

              {section.type === "roles" && (
                <>
                  <table className={cn("w-full border-collapse", border, "border-doc-line")}>
                    <thead>
                      <tr className="bg-doc-header text-doc-header-foreground">
                        <th className={cn(border, "border-doc-line p-2 text-left text-xs font-bold uppercase w-[26%]")}>Role</th>
                        <th className={cn(border, "border-doc-line p-2 text-left text-xs font-bold uppercase w-[38%]")}>Name(s)</th>
                        <th className={cn(border, "border-doc-line p-2 text-left text-xs font-bold uppercase")}>Comment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.items.map((it) => (
                        <tr key={it.id} className="align-top">
                          <td className={cn(border, "border-doc-line p-1")}>
                            <input
                              className={cn(cellClass, "font-medium")}
                              value={it.a}
                              onChange={(e) => patch(section.id, it.id, "a", e.target.value)}
                            />
                          </td>
                          <td className={cn(border, "border-doc-line p-1")}>
                            <input
                              className={cellClass}
                              value={it.b}
                              onChange={(e) => patch(section.id, it.id, "b", e.target.value)}
                            />
                          </td>
                          <td className={cn(border, "border-doc-line p-1")}>
                            <div className="flex items-center gap-1">
                              <input
                                className={cellClass}
                                value={it.c}
                                placeholder="—"
                                onChange={(e) => patch(section.id, it.id, "c", e.target.value)}
                              />
                              <RemoveBtn onClick={() => removeItem(section.id, it.id)} label="Remove row" />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <AddBtn onClick={() => addItem(section.id)} label="Add row" />
                </>
              )}

              {section.type === "steps" && (
                <>
                  <table className={cn("w-full border-collapse", border, "border-doc-line")}>
                    <thead>
                      <tr className="bg-doc-header text-doc-header-foreground">
                        <th className={cn(border, "border-doc-line p-2 text-left text-xs font-bold uppercase w-[24%]")}>Simple</th>
                        <th className={cn(border, "border-doc-line p-2 text-left text-xs font-bold uppercase")}>Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.items.map((it) => (
                        <tr key={it.id}>
                          <td className={cn(border, "border-doc-line p-1")}>
                            <input
                              className={cn(cellClass, "font-semibold")}
                              value={it.a}
                              onChange={(e) => patch(section.id, it.id, "a", e.target.value)}
                            />
                          </td>
                          <td className={cn(border, "border-doc-line p-1")}>
                            <div className="flex items-center gap-1">
                              <input
                                className={cellClass}
                                value={it.b}
                                onChange={(e) => patch(section.id, it.id, "b", e.target.value)}
                              />
                              <RemoveBtn onClick={() => removeItem(section.id, it.id)} label="Remove step" />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <AddBtn onClick={() => addItem(section.id)} label="Add step" />
                </>
              )}

              {section.type === "checklist" && (
                <ChecklistSection
                  section={section}
                  border={border}
                  cellClass={cellClass}
                  checked={checked}
                  setChecked={setChecked}
                  patch={patch}
                  removeItem={removeItem}
                  addItem={addItem}
                />
              )}

              {section.type === "tasks" && (
                <TaskSection
                  section={section}
                  border={border}
                  cellClass={cellClass}
                  checked={checked}
                  setChecked={setChecked}
                  patch={patch}
                  removeItem={removeItem}
                  addItem={addItem}
                  hostNames={hostNames}
                />
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function AddBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button variant="outline" size="sm" className="no-print mt-2" onClick={onClick}>
      <Plus className="mr-1 h-3.5 w-3.5" /> {label}
    </Button>
  );
}

interface ChecklistProps {
  section: DocSection;
  border: string;
  cellClass: string;
  checked: Record<string, boolean>;
  setChecked: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  patch: (sid: string, itemId: string, key: "a" | "b" | "c", value: string) => void;
  removeItem: (sid: string, itemId: string) => void;
  addItem: (sid: string, a?: string, c?: string) => void;
}

function ChecklistSection({
  section,
  border,
  cellClass,
  checked,
  setChecked,
  patch,
  removeItem,
  addItem,
}: ChecklistProps) {
  const groups: Array<{ name: string; items: DocTemplateItem[] }> = [];
  for (const it of section.items) {
    const name = it.a || "Checklist";
    const existing = groups.find((g) => g.name === name);
    if (existing) existing.items.push(it);
    else groups.push({ name, items: [it] });
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3 print:grid-cols-3">
        {groups.map((group) => (
          <div key={group.name} className={cn("rounded-md p-3", border, "border-doc-line")}>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-doc-header">
              {group.name}
            </p>
            <ul className="space-y-1.5">
              {group.items.map((it) => (
                <li key={it.id} className="flex items-start gap-1 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1.5 h-3.5 w-3.5 shrink-0 accent-[var(--doc-header)]"
                    checked={!!checked[it.id]}
                    onChange={(e) => setChecked((p) => ({ ...p, [it.id]: e.target.checked }))}
                  />
                  <span className="min-w-0 flex-1">
                    <input
                      className={cn(cellClass, "print:hidden")}
                      value={it.b}
                      onChange={(e) => patch(section.id, it.id, "b", e.target.value)}
                    />
                    <PrintText value={it.b} />
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="no-print h-6 w-6 shrink-0"
                    onClick={() => removeItem(section.id, it.id)}
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              size="sm"
              className="no-print mt-2"
              onClick={() => addItem(section.id, group.name)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add item
            </Button>
          </div>
        ))}
      </div>
      <AddBtn onClick={() => addItem(section.id, "New section")} label="Add group" />
    </>
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

interface TaskSectionProps extends ChecklistProps {
  hostNames: string[];
}

const DEFAULT_TASK_HEADERS: [string, string, string] = ["Task", "Assigned to", "Status"];

function TaskSection({
  section,
  border,
  cellClass,
  checked,
  setChecked,
  patch,
  removeItem,
  addItem,
  hostNames,
}: TaskSectionProps) {
  const [headers, setHeaders] = useState<[string, string, string]>(DEFAULT_TASK_HEADERS);
  const [bold, setBold] = useState<[boolean, boolean, boolean]>([true, true, true]);

  const setHeader = (i: 0 | 1 | 2, v: string) =>
    setHeaders((p) => {
      const n = [...p] as [string, string, string];
      n[i] = v;
      return n;
    });

  const toggleBold = (i: 0 | 1 | 2) =>
    setBold((p) => {
      const n = [...p] as [boolean, boolean, boolean];
      n[i] = !n[i];
      return n;
    });

  const groups: Array<{ name: string; items: DocTemplateItem[] }> = [];
  for (const it of section.items) {
    const name = it.c || "Tasks";
    const existing = groups.find((g) => g.name === name);
    if (existing) existing.items.push(it);
    else groups.push({ name, items: [it] });
  }

  const headerInput = (i: 0 | 1 | 2, extra = "") => (
    <span className="flex items-center gap-0.5">
      <input
        className={cn(
          "w-full min-w-0 bg-transparent text-[10px] uppercase tracking-wide outline-none placeholder:text-doc-header-foreground/60",
          bold[i] ? "font-bold" : "font-normal",
          extra,
        )}
        value={headers[i]}
        onChange={(e) => setHeader(i, e.target.value)}
      />
      <button
        type="button"
        onClick={() => toggleBold(i)}
        aria-label={`Toggle bold for ${headers[i]}`}
        className={cn(
          "no-print rounded px-1 text-[10px] leading-none",
          bold[i] ? "bg-doc-header-foreground/25" : "opacity-60",
        )}
      >
        B
      </button>
    </span>
  );

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
        {groups.map((group) => (
          <div key={group.name} className={cn("rounded-md p-3", border, "border-doc-line")}>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-doc-header">
              {group.name}
            </p>

            <div className="flex items-center gap-2 rounded-sm bg-doc-header px-2 py-1 text-doc-header-foreground">
              <div className="flex-1">{headerInput(0)}</div>
              <div className="w-[38%]">{headerInput(1)}</div>
              <div className="w-[46px] shrink-0">{headerInput(2, "text-center")}</div>
              <span className="no-print w-6 shrink-0" />
            </div>

            <ul className="mt-1 divide-y divide-doc-line">
              {group.items.map((it) => (
                <li key={it.id} className="flex items-center gap-2 py-1">
                  <input
                    className={cn(cellClass, "flex-1 font-medium")}
                    value={it.a}
                    onChange={(e) => patch(section.id, it.id, "a", e.target.value)}
                  />
                  <input
                    className={cn(cellClass, "w-[38%] doc-col-name")}
                    list="sunday-docs-hosts"
                    placeholder="—"
                    value={it.b}
                    onChange={(e) => patch(section.id, it.id, "b", e.target.value)}
                  />
                  <span className="flex w-[46px] shrink-0 justify-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--doc-header)]"
                      checked={!!checked[it.id]}
                      onChange={(e) => setChecked((p) => ({ ...p, [it.id]: e.target.checked }))}
                    />
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="no-print h-6 w-6 shrink-0"
                    onClick={() => removeItem(section.id, it.id)}
                    aria-label="Remove task"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
            <AddBtn onClick={() => addItem(section.id, "", group.name)} label="Add task" />
          </div>
        ))}
      </div>
      <datalist id="sunday-docs-hosts">
        {hostNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <AddBtn onClick={() => addItem(section.id, "", "New group")} label="Add group" />
    </>
  );
}
