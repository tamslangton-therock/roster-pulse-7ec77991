// Sunday Docs template model.
// The template is the *draft* — layout, section order, base text and page
// breaks. "Generate Sunday Docs" fills the live roster names into it.

export type DocSectionType = "roles" | "steps" | "checklist" | "tasks" | "note";

export const SECTION_TYPE_LABELS: Record<DocSectionType, string> = {
  roles: "Role table (auto-filled from the roster)",
  steps: "Two-column list (Simple / Detail)",
  checklist: "Checklist groups",
  tasks: "Task assignments, grouped (Task / Assigned / Status)",
  note: "Highlighted note banner",
};

/** Column meanings per section type — used to label the editor inputs. */
export const SECTION_COLUMNS: Record<DocSectionType, [string, string, string] | [string, string] | [string]> = {
  roles: ["Role", "Default name(s)", "Comment"],
  steps: ["Simple", "Detail"],
  checklist: ["Group", "Item"],
  tasks: ["Task", "Default assignee", "Group"],
  note: ["Text"],
};

export interface DocTemplateItem {
  id: string;
  a: string;
  b: string;
  c: string;
}

export interface DocSection {
  id: string;
  title: string;
  type: DocSectionType;
  /** Start this section on a new printed page. */
  pageBreak: boolean;
  items: DocTemplateItem[];
}

/** Flat row shape stored in the Google Sheet (one row per item). */
export interface DocTemplateRow {
  section_id: string;
  section_title: string;
  section_type: string;
  page_break: string;
  row_order: number;
  col_a: string;
  col_b: string;
  col_c: string;
}

export const uid = () => Math.random().toString(36).slice(2, 9);

const HUDDLE_STEPS: Array<[string, string]> = [
  ["Gather", "Everyone in the auditorium 60 minutes before the service starts."],
  ["Welcome", "Host welcomes the team, introduces any new or visiting servers."],
  ["Vision", "Short reminder of why we serve — people meeting Jesus today."],
  ["Run sheet", "Walk the service order: worship, notices, message, response."],
  ["Roles", "Confirm each area knows their position and hand-off points."],
  ["Notices", "Any announcements, events or changes for this Sunday."],
  ["Pray", "Pray together for the service, the guests and the team."],
  ["Positions", "Team in position 30 minutes before doors open."],
];

const HOST_CHECKLIST: Array<[string, string]> = [
  ["Pre-Service", "Unlock doors and switch on foyer lights"],
  ["Pre-Service", "Check auditorium seating and tidy chairs"],
  ["Pre-Service", "Communion table set and covered"],
  ["Pre-Service", "Welcome desk stocked with connect cards and pens"],
  ["Pre-Service", "Confirm all hosting positions are filled"],
  ["Service Starts", "Doors closed once worship begins"],
  ["Service Starts", "Late arrivals seated at the back"],
  ["Service Starts", "Count attendance and record on the sheet"],
  ["Service Starts", "Communion servers in position before the response"],
  ["In-Between Services", "Reset chairs and clear cups"],
  ["In-Between Services", "Restock communion elements"],
  ["In-Between Services", "Empty foyer bins"],
  ["In-Between Services", "Brief the second-service hosts"],
];

/** [task, group] — tasks are displayed grouped by the third column. */
const HOST_TASKS: Array<[string, string]> = [
  ["Cut Communion Bread", "Communion"],
  ["Pour Communion Juice", "Communion"],
  ["Left Front Communion", "Communion"],
  ["Right Front Communion", "Communion"],
  ["Back Communion", "Communion"],
  ["Offering Bags", "Offering"],
  ["Door Greeting", "Front of House"],
  ["Attendance Count", "Front of House"],
];

const item = (a: string, b = "", c = ""): DocTemplateItem => ({ id: uid(), a, b, c });

export function defaultDocTemplate(): DocSection[] {
  return [
    {
      id: uid(),
      title: "Team Huddle Overview",
      type: "roles",
      pageBreak: false,
      items: [],
    },
    {
      id: uid(),
      title: "",
      type: "note",
      pageBreak: false,
      items: [
        item(
          "Reminder: please arrive 60 minutes before the service and check in with your team leader.",
        ),
      ],
    },
    {
      id: uid(),
      title: "Team Huddle Briefing",
      type: "steps",
      pageBreak: true,
      items: HUDDLE_STEPS.map(([a, b]) => item(a, b)),
    },
    {
      id: uid(),
      title: "Host Checklist",
      type: "checklist",
      pageBreak: false,
      items: HOST_CHECKLIST.map(([a, b]) => item(a, b)),
    },
    {
      id: uid(),
      title: "Hosting Task Assignments",
      type: "tasks",
      pageBreak: true,
      items: HOST_TASKS.map(([t, g]) => item(t, "", g)),
    },
    {
      id: uid(),
      title: "",
      type: "note",
      pageBreak: false,
      items: [
        item(
          "Any swaps on the day must be confirmed with the host before the service starts.",
        ),
      ],
    },
  ];
}

const TYPES: DocSectionType[] = ["roles", "steps", "checklist", "tasks", "note"];

export function rowsToSections(rows: DocTemplateRow[]): DocSection[] {
  const bySection = new Map<string, DocSection>();
  const order: string[] = [];
  for (const r of rows) {
    const id = String(r.section_id || "").trim();
    if (!id) continue;
    if (!bySection.has(id)) {
      const type = (TYPES as string[]).includes(r.section_type)
        ? (r.section_type as DocSectionType)
        : "steps";
      bySection.set(id, {
        id,
        title: r.section_title ?? "",
        type,
        pageBreak: /^(y|yes|true|1)$/i.test(String(r.page_break ?? "")),
        items: [],
      });
      order.push(id);
    }
    const section = bySection.get(id)!;
    if (r.col_a || r.col_b || r.col_c) {
      section.items.push({ id: uid(), a: r.col_a ?? "", b: r.col_b ?? "", c: r.col_c ?? "" });
    }
  }
  return order.map((id) => bySection.get(id)!);
}

export function sectionsToRows(sections: DocSection[]): DocTemplateRow[] {
  const rows: DocTemplateRow[] = [];
  sections.forEach((s, si) => {
    const base = {
      section_id: s.id,
      section_title: s.title,
      section_type: s.type,
      page_break: s.pageBreak ? "yes" : "no",
    };
    if (s.items.length === 0) {
      rows.push({ ...base, row_order: si * 1000, col_a: "", col_b: "", col_c: "" });
      return;
    }
    s.items.forEach((it, ii) => {
      rows.push({
        ...base,
        row_order: si * 1000 + ii,
        col_a: it.a,
        col_b: it.b,
        col_c: it.c,
      });
    });
  });
  return rows;
}
