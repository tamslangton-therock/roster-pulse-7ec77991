import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import {
  Bell,
  BellRing,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  Plus,
  Tag,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useRoster } from "@/lib/store";
import type { TaskRow } from "@/lib/sheets.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — Roster Pulse" },
      {
        name: "description",
        content:
          "Simple task board for church teams: capture to-dos and thoughts, set reminders, assign an owner and track them through to done.",
      },
      { property: "og:title", content: "Tasks — Roster Pulse" },
      {
        property: "og:description",
        content: "Capture to-dos, set reminders, assign owners and track progress.",
      },
    ],
  }),
  component: TasksPage,
});

const COLUMNS: { key: TaskRow["Status"]; title: string; tone: string }[] = [
  { key: "todo", title: "To do", tone: "bg-amber-50 border-amber-200" },
  { key: "in_progress", title: "In process", tone: "bg-sky-50 border-sky-200" },
  { key: "done", title: "Done", tone: "bg-emerald-50 border-emerald-200" },
];

function fmt(value: string, pattern: string) {
  if (!value) return "";
  const d = parseISO(value);
  return isValid(d) ? format(d, pattern) : value;
}

/** Fires browser notifications + toasts for tasks whose reminder time has passed. */
function useReminders(tasks: TaskRow[]) {
  const fired = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem("rp-fired-reminders");
      if (saved) fired.current = new Set(JSON.parse(saved) as string[]);
    } catch {
      /* ignore */
    }
    const tick = () => {
      const now = Date.now();
      for (const t of useRoster.getState().tasks) {
        if (!t.RemindAt || t.Status === "done") continue;
        const key = `${t.TaskID}::${t.RemindAt}`;
        if (fired.current.has(key)) continue;
        const when = parseISO(t.RemindAt);
        if (!isValid(when) || when.getTime() > now) continue;
        fired.current.add(key);
        try {
          window.localStorage.setItem(
            "rp-fired-reminders",
            JSON.stringify([...fired.current].slice(-500)),
          );
        } catch {
          /* ignore */
        }
        toast(`Reminder: ${t.Title}`, {
          description: [t.AssignedTo, t.Notes].filter(Boolean).join(" — ") || undefined,
          duration: 15000,
        });
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(`Reminder: ${t.Title}`, {
            body: [t.AssignedTo, t.Notes].filter(Boolean).join(" — "),
          });
        }
      }
    };
    tick();
    const id = window.setInterval(tick, 30000);
    return () => window.clearInterval(id);
  }, [tasks.length]);
}

function TasksPage() {
  const tasks = useRoster((s) => s.tasks);
  const volunteers = useRoster((s) => s.volunteers);
  const addTask = useRoster((s) => s.addTask);
  const updateTask = useRoster((s) => s.updateTask);
  const removeTask = useRoster((s) => s.removeTask);
  const ready = useRoster((s) => s.ready);
  const loading = useRoster((s) => s.loading);

  useReminders(tasks);

  const [groupBy, setGroupBy] = useState<"none" | "person" | "category">("none");
  const [personFilter, setPersonFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TaskRow | null>(null);

  const people = useMemo(
    () =>
      [...new Set(volunteers.map((v) => v.full_name).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [volunteers],
  );
  const categories = useMemo(
    () => [...new Set(tasks.map((t) => t.Category).filter(Boolean))].sort(),
    [tasks],
  );

  const filtered = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (personFilter === "all" || (t.AssignedTo || "Unassigned") === personFilter) &&
          (categoryFilter === "all" || (t.Category || "Uncategorised") === categoryFilter),
      ),
    [tasks, personFilter, categoryFilter],
  );

  const groups = useMemo(() => {
    if (groupBy === "none") return [{ name: "All tasks", items: filtered }];
    const map = new Map<string, TaskRow[]>();
    for (const t of filtered) {
      const key =
        groupBy === "person" ? t.AssignedTo || "Unassigned" : t.Category || "Uncategorised";
      const list = map.get(key) ?? [];
      list.push(t);
      map.set(key, list);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, items]) => ({ name, items }));
  }, [filtered, groupBy]);

  const move = (task: TaskRow, dir: -1 | 1) => {
    const order: TaskRow["Status"][] = ["todo", "in_progress", "done"];
    const next = order[Math.min(2, Math.max(0, order.indexOf(task.Status) + dir))];
    if (next && next !== task.Status) updateTask(task.TaskID, { Status: next });
  };

  const askNotifications = async () => {
    if (!("Notification" in window)) {
      toast.error("This browser doesn't support notifications");
      return;
    }
    const res = await Notification.requestPermission();
    toast[res === "granted" ? "success" : "error"](
      res === "granted" ? "Reminders will pop up on this device" : "Notifications blocked",
    );
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ListTodo className="h-6 w-6 text-primary" /> Tasks
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Capture to-dos and thoughts, set a reminder, assign an owner, then move them to done.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={askNotifications}>
            <Bell className="mr-1 h-4 w-4" /> Enable reminders
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> New task
          </Button>
        </div>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Group by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No grouping</SelectItem>
            <SelectItem value="person">Group by person</SelectItem>
            <SelectItem value="category">Group by category</SelectItem>
          </SelectContent>
        </Select>
        <Select value={personFilter} onValueChange={setPersonFilter}>
          <SelectTrigger className="h-9 w-[200px]">
            <SelectValue placeholder="Person" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All people</SelectItem>
            <SelectItem value="Unassigned">Unassigned</SelectItem>
            {people.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-9 w-[200px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="Uncategorised">Uncategorised</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && !ready ? (
        <p className="text-sm text-muted-foreground">Loading tasks…</p>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No tasks yet. Create your first one to get going.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.name}>
              {groupBy !== "none" && (
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  {groupBy === "person" ? (
                    <User className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Tag className="h-4 w-4 text-muted-foreground" />
                  )}
                  {group.name}
                  <span className="text-xs font-normal text-muted-foreground">
                    ({group.items.length})
                  </span>
                </h2>
              )}
              <div className="grid gap-4 md:grid-cols-3">
                {COLUMNS.map((col) => {
                  const items = group.items.filter((t) => t.Status === col.key);
                  return (
                    <div key={col.key} className={`rounded-xl border p-3 ${col.tone}`}>
                      <div className="mb-3 flex items-center justify-between px-1">
                        <span className="text-sm font-medium">{col.title}</span>
                        <span className="text-xs text-muted-foreground">{items.length}</span>
                      </div>
                      <div className="space-y-2">
                        {items.length === 0 && (
                          <p className="px-1 py-4 text-center text-xs text-muted-foreground">
                            Nothing here
                          </p>
                        )}
                        {items.map((t) => (
                          <article
                            key={t.TaskID}
                            className="rounded-lg border bg-card p-3 shadow-sm"
                          >
                            <div className="flex items-start gap-2">
                              <Checkbox
                                checked={t.Status === "done"}
                                onCheckedChange={(v) =>
                                  updateTask(t.TaskID, { Status: v ? "done" : "todo" })
                                }
                                className="mt-0.5"
                              />
                              <button
                                type="button"
                                className="flex-1 text-left"
                                onClick={() => {
                                  setEditing(t);
                                  setOpen(true);
                                }}
                              >
                                <span
                                  className={`text-sm font-medium ${
                                    t.Status === "done"
                                      ? "text-muted-foreground line-through"
                                      : ""
                                  }`}
                                >
                                  {t.Title}
                                </span>
                                {t.Notes && (
                                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                    {t.Notes}
                                  </p>
                                )}
                              </button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground"
                                onClick={() => removeTask(t.TaskID)}
                                aria-label="Delete task"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                              {t.AssignedTo && (
                                <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5">
                                  <User className="h-3 w-3" /> {t.AssignedTo}
                                </span>
                              )}
                              {t.Category && (
                                <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5">
                                  <Tag className="h-3 w-3" /> {t.Category}
                                </span>
                              )}
                              {t.DueDate && (
                                <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5">
                                  <CalendarClock className="h-3 w-3" /> {fmt(t.DueDate, "d MMM")}
                                </span>
                              )}
                              {t.RemindAt && (
                                <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5">
                                  <BellRing className="h-3 w-3" />{" "}
                                  {fmt(t.RemindAt, "d MMM HH:mm")}
                                </span>
                              )}
                            </div>
                            <div className="mt-2 flex justify-between">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                disabled={t.Status === "todo"}
                                onClick={() => move(t, -1)}
                              >
                                <ChevronLeft className="h-3.5 w-3.5" /> Back
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                disabled={t.Status === "done"}
                                onClick={() => move(t, 1)}
                              >
                                {t.Status === "in_progress" ? "Done" : "Start"}{" "}
                                {t.Status === "in_progress" ? (
                                  <Check className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <TaskDialog
        open={open}
        onOpenChange={setOpen}
        task={editing}
        people={people}
        categories={categories}
        onCreate={addTask}
        onUpdate={updateTask}
      />
    </div>
  );
}

function TaskDialog({
  open,
  onOpenChange,
  task,
  people,
  categories,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task: TaskRow | null;
  people: string[];
  categories: string[];
  onCreate: (t: Partial<TaskRow> & { Title: string }) => string;
  onUpdate: (id: string, updates: Partial<TaskRow>) => void;
}) {
  const [form, setForm] = useState({
    Title: "",
    Notes: "",
    Category: "",
    AssignedTo: "",
    DueDate: "",
    RemindAt: "",
    Status: "todo" as TaskRow["Status"],
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      Title: task?.Title ?? "",
      Notes: task?.Notes ?? "",
      Category: task?.Category ?? "",
      AssignedTo: task?.AssignedTo ?? "",
      DueDate: task?.DueDate ?? "",
      RemindAt: task?.RemindAt ? task.RemindAt.slice(0, 16) : "",
      Status: task?.Status ?? "todo",
    });
  }, [open, task]);

  const save = () => {
    if (!form.Title.trim()) {
      toast.error("Give the task a title");
      return;
    }
    const payload = { ...form, Title: form.Title.trim() };
    if (task) onUpdate(task.TaskID, payload);
    else onCreate(payload);
    toast.success(task ? "Task updated" : "Task added");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription>
            Saved straight to the Tasks tab in your Google Sheet.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="t-title">Task / thought</Label>
            <Input
              id="t-title"
              value={form.Title}
              autoFocus
              placeholder="e.g. Book the sound engineer for Easter"
              onChange={(e) => setForm((f) => ({ ...f, Title: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="t-notes">Notes</Label>
            <Textarea
              id="t-notes"
              rows={3}
              value={form.Notes}
              onChange={(e) => setForm((f) => ({ ...f, Notes: e.target.value }))}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="t-person">Assigned to</Label>
              <Input
                id="t-person"
                list="rp-people"
                value={form.AssignedTo}
                placeholder="Person"
                onChange={(e) => setForm((f) => ({ ...f, AssignedTo: e.target.value }))}
              />
              <datalist id="rp-people">
                {people.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <div>
              <Label htmlFor="t-cat">Category / event</Label>
              <Input
                id="t-cat"
                list="rp-cats"
                value={form.Category}
                placeholder="e.g. Easter Service"
                onChange={(e) => setForm((f) => ({ ...f, Category: e.target.value }))}
              />
              <datalist id="rp-cats">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <Label htmlFor="t-due">Due date</Label>
              <Input
                id="t-due"
                type="date"
                value={form.DueDate}
                onChange={(e) => setForm((f) => ({ ...f, DueDate: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="t-remind">Reminder</Label>
              <Input
                id="t-remind"
                type="datetime-local"
                value={form.RemindAt}
                onChange={(e) => setForm((f) => ({ ...f, RemindAt: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={form.Status}
              onValueChange={(v) => setForm((f) => ({ ...f, Status: v as TaskRow["Status"] }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">To do</SelectItem>
                <SelectItem value="in_progress">In process</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save}>{task ? "Save changes" : "Add task"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
