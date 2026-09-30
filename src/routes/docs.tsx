import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRoster } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { AccessNotice } from "@/components/access-notice";
import {
  SECTION_COLUMNS,
  SECTION_TYPE_LABELS,
  defaultDocTemplate,
  uid,
  type DocSection,
  type DocSectionType,
} from "@/lib/doc-template";
import { areasOf } from "@/lib/roster-grid";



export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Sunday Doc Templates — Roster Pulse" },
      {
        name: "description",
        content:
          "Design the Sunday huddle document templates — sections, base text, table rows and page breaks — that the roster generator fills names into.",
      },
      { property: "og:title", content: "Sunday Doc Templates — Roster Pulse" },
      {
        property: "og:description",
        content: "Edit the draft Sunday docs that the roster generator fills with names.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MasterOnlyDocs,
});

const TYPES: DocSectionType[] = ["roles", "steps", "checklist", "tasks", "note"];

function DocsTemplatePage() {
  const docTemplate = useRoster((s) => s.docTemplate);
  const setDocTemplate = useRoster((s) => s.setDocTemplate);
  const resetDocTemplate = useRoster((s) => s.resetDocTemplate);
  const loading = useRoster((s) => s.loading);
  const layoutSlots = useRoster((s) => s.slots);
  const [confirmReset, setConfirmReset] = useState(false);

  const roleKeys = useMemo(
    () =>
      Array.from(
        new Set(layoutSlots.map((s) => (s.role ? `${s.area} — ${s.role}` : s.area))),
      ).sort((a, b) => a.localeCompare(b)),
    [layoutSlots],
  );

  const update = (sections: DocSection[]) => setDocTemplate(sections);

  const patchSection = (id: string, updates: Partial<DocSection>) =>
    update(docTemplate.map((s) => (s.id === id ? { ...s, ...updates } : s)));

  const move = (index: number, dir: -1 | 1) => {
    const next = [...docTemplate];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    update(next);
  };

  const addSection = (type: DocSectionType) =>
    update([
      ...docTemplate,
      {
        id: `sec-${uid()}`,
        title: type === "note" ? "" : "New section",
        type,
        pageBreak: false,
        items: type === "note" ? [{ id: uid(), a: "", b: "", c: "" }] : [],
      },
    ]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sunday Doc Templates</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            This is the draft the "Generate Sunday Docs" button starts from. Set the sections,
            base text and page breaks here — names come from the live roster for the Sunday you
            pick on Team Print, and you can still tweak everything before printing.
          </p>
        </div>
        <Button
          variant={confirmReset ? "destructive" : "outline"}
          onClick={() => {
            if (confirmReset) {
              resetDocTemplate();
              setConfirmReset(false);
            } else setConfirmReset(true);
          }}
        >
          <RotateCcw className="mr-1.5 h-4 w-4" />
          {confirmReset ? "Confirm reset" : "Reset to default"}
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading template…</p>}

      <div className="space-y-4">
        {docTemplate.map((section, index) => (
          <div key={section.id} className="rounded-xl border bg-card p-4 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                className="max-w-xs"
                placeholder={section.type === "note" ? "(note banner — no title)" : "Section title"}
                value={section.title}
                onChange={(e) => patchSection(section.id, { title: e.target.value })}
              />
              <Select
                value={section.type}
                onValueChange={(v) => patchSection(section.id, { type: v as DocSectionType })}
              >
                <SelectTrigger className="w-[280px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {SECTION_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Switch
                  id={`pb-${section.id}`}
                  checked={section.pageBreak}
                  onCheckedChange={(v) => patchSection(section.id, { pageBreak: v })}
                />
                <Label htmlFor={`pb-${section.id}`} className="text-xs">
                  Start on a new page
                </Label>
              </div>

              <div className="ml-auto flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => move(index, -1)} aria-label="Move up">
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => move(index, 1)} aria-label="Move down">
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => update(docTemplate.filter((s) => s.id !== section.id))}
                  aria-label="Remove section"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {section.type === "roles" && section.items.length === 0 && (
              <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                No rows set — every role for the selected serving areas is pulled in
                automatically when you generate. Add rows below to fix the order and wording.
              </p>
            )}

            <SectionItems
              section={section}
              roleKeys={roleKeys}
              onChange={(items) => patchSection(section.id, { items })}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <Button key={t} variant="outline" size="sm" onClick={() => addSection(t)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> {SECTION_TYPE_LABELS[t]}
          </Button>
        ))}
      </div>

      {docTemplate.length === 0 && (
        <Button onClick={() => update(defaultDocTemplate())}>Load the default pack</Button>
      )}
    </div>
  );
}

function SectionItems({
  section,
  roleKeys,
  onChange,
}: {
  section: DocSection;
  roleKeys: string[];
  onChange: (items: DocSection["items"]) => void;
}) {
  const cols = SECTION_COLUMNS[section.type];
  const items = section.items;

  const patch = (id: string, key: "a" | "b" | "c", value: string) =>
    onChange(items.map((it) => (it.id === id ? { ...it, [key]: value } : it)));

  const moveItem = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="flex gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {cols.map((c) => (
            <span key={c} className="flex-1">
              {c}
            </span>
          ))}
          <span className="w-[104px]" />
        </div>
      )}
      {items.map((it, itemIndex) => (
        <div key={it.id} className="flex items-center gap-2">
          {section.type === "note" ? (
            <textarea
              className="flex-1 resize-none rounded-md border bg-background p-2 text-sm"
              rows={2}
              value={it.a}
              onChange={(e) => patch(it.id, "a", e.target.value)}
            />
          ) : (
            <>
              <Input
                className="flex-1"
                list={section.type === "roles" ? "doc-role-keys" : undefined}
                placeholder={cols[0]}
                value={it.a}
                onChange={(e) => patch(it.id, "a", e.target.value)}
              />
              {cols.length > 1 && (
                <Input
                  className="flex-1"
                  placeholder={cols[1]}
                  value={it.b}
                  onChange={(e) => patch(it.id, "b", e.target.value)}
                />
              )}
              {cols.length > 2 && (
                <Input
                  className="flex-1"
                  placeholder={cols[2]}
                  value={it.c}
                  onChange={(e) => patch(it.id, "c", e.target.value)}
                />
              )}
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            disabled={itemIndex === 0}
            onClick={() => moveItem(itemIndex, -1)}
            aria-label="Move row up"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            disabled={itemIndex === items.length - 1}
            onClick={() => moveItem(itemIndex, 1)}
            aria-label="Move row down"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => onChange(items.filter((x) => x.id !== it.id))}
            aria-label="Remove row"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <datalist id="doc-role-keys">
        {roleKeys.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, { id: uid(), a: "", b: "", c: "" }])}
      >
        <Plus className="mr-1 h-3.5 w-3.5" /> Add row
      </Button>
    </div>
  );
}

function MasterOnlyDocs() {
  const isMaster = useAuth((s) => s.master);
  if (!isMaster) {
    return <AccessNotice title="Doc Templates are admin-only" />;
  }
  return <DocsTemplatePage />;
}
