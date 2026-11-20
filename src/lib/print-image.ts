import { format, parseISO } from "date-fns";
import type { SlotDef } from "@/lib/roster-grid";

export interface RosterImageData {
  area: string;
  rangeLabel: string;
  dates: string[];
  slots: SlotDef[];
  /** date -> slot label -> person name */
  cellMap: Record<string, Record<string, string>>;
  colorFor: (person: string, slotLabel?: string) => { bg: string; border: string; text: string };
  slotSuffix: (s: SlotDef) => string;
}

const FONT = "system-ui, -apple-system, Segoe UI, sans-serif";

/** Renders the printable team roster table as a PNG blob for pasting into WhatsApp. */
export function renderRosterImage(data: RosterImageData): Promise<Blob> {
  const { area, rangeLabel, dates, slots, cellMap, colorFor, slotSuffix } = data;

  const scale = 2; // crisp on phone screens
  const P = 48;
  const dateColW = 210;

  const scratch = document.createElement("canvas").getContext("2d")!;

  // Size each column to its content so narrow rosters don't leave dead space
  // on the right. Width = longest name or header in the column, with padding.
  const colWFor = (s: SlotDef): number => {
    const num = slotSuffix(s);
    const header = `${s.role || s.area}${num ? ` ${num}` : ""}`;
    scratch.font = `700 22px ${FONT}`;
    let need = scratch.measureText(header).width + 32;
    scratch.font = `600 22px ${FONT}`;
    for (const d of dates) {
      const p = cellMap[d]?.[s.label];
      if (p) need = Math.max(need, scratch.measureText(p).width + 56);
    }
    return Math.min(380, Math.max(170, Math.ceil(need)));
  };
  const colWs = slots.map(colWFor);
  const colX = (i: number) => P + dateColW + colWs.slice(0, i).reduce((a, b) => a + b, 0);

  // Canvas width hugs the table; the title gets room too.
  scratch.font = `700 44px ${FONT}`;
  const titleW = scratch.measureText(`${area} Team Roster`).width;
  const tableW = dateColW + colWs.reduce((a, b) => a + b, 0);
  const W = Math.min(2200, Math.ceil(Math.max(tableW, titleW) + P * 2));
  // If capped, shrink columns proportionally so the table still fits.
  if (tableW + P * 2 > W) {
    const f = (W - P * 2 - dateColW) / Math.max(colWs.reduce((a, b) => a + b, 0), 1);
    for (let i = 0; i < colWs.length; i++) colWs[i] = Math.max(140, Math.floor(colWs[i]! * f));
  }
  const colW = (i: number) => colWs[i] ?? 170;

  // Pre-wrap names so we know each row's height. Font must match what will be
  // drawn, or the measurement wraps text that would have fitted on one line.
  const wrap = (text: string, max: number, font = `600 22px ${FONT}`): string[] => {
    scratch.font = font;
    const words = text.split(" ");
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (scratch.measureText(t).width > max && line) {
        lines.push(line);
        line = w;
      } else line = t;
    }
    lines.push(line);
    return lines;
  };

  const headerH = 64;
  const titleH = 150;
  const rowH = 64;
  const pillLineH = 30;
  const rowsH = dates.reduce((sum, d) => {
    const maxLines = Math.max(
      1,
      ...slots.map((s, i) => {
        const p = cellMap[d]?.[s.label];
        return p ? wrap(p, colW(i) - 40).length : 1;
      }),
    );
    return sum + Math.max(rowH, maxLines * pillLineH + 28);
  }, 0);
  const H = P + titleH + headerH + rowsH + P;

  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  let y = P;

  // Title
  ctx.fillStyle = "#181f2a";
  ctx.font = `700 44px ${FONT}`;
  ctx.fillText(`${area} Team Roster`, P, y + 44);
  ctx.fillStyle = "#5d6571";
  ctx.font = `26px ${FONT}`;
  ctx.fillText(rangeLabel, P, y + 88);
  ctx.fillStyle = "#8a919e";
  ctx.font = `22px ${FONT}`;
  ctx.fillText("The Rock Church", P, y + 122);
  y += titleH;

  // Table header
  ctx.strokeStyle = "#d8d9d4";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(P, y + headerH - 8);
  ctx.lineTo(W - P, y + headerH - 8);
  ctx.stroke();

  ctx.fillStyle = "#181f2a";
  ctx.font = `700 24px ${FONT}`;
  ctx.fillText("Sunday", P + 8, y + 34);
  slots.forEach((s, i) => {
    const x = colX(i);
    ctx.strokeStyle = "#e8e5dd";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + 4);
    ctx.lineTo(x, y + headerH - 8);
    ctx.stroke();
    const num = slotSuffix(s);
    const label = `${s.role || s.area}${num ? ` ${num}` : ""}`;
    ctx.fillStyle = "#181f2a";
    ctx.font = `700 22px ${FONT}`;
    const lines = wrap(label, colW(i) - 16, `700 22px ${FONT}`).slice(0, 2);
    lines.forEach((l, li) => ctx.fillText(l, x + 10, y + 30 + li * 26 - (lines.length > 1 ? 8 : 0)));
  });
  y += headerH;

  // Date rows
  dates.forEach((d, rowIndex) => {
    const cellLines = slots.map((s, i) => {
      const p = cellMap[d]?.[s.label];
      return p ? wrap(p, colW(i) - 40) : null;
    });
    const maxLines = Math.max(1, ...cellLines.map((l) => l?.length ?? 1));
    const thisRowH = Math.max(rowH, maxLines * pillLineH + 28);

    if (rowIndex % 2 === 1) {
      ctx.fillStyle = "#faf9f7";
      ctx.fillRect(P, y, W - P * 2, thisRowH);
    }
    ctx.strokeStyle = "#e8e5dd";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(P, y + thisRowH);
    ctx.lineTo(W - P, y + thisRowH);
    ctx.stroke();

    ctx.fillStyle = "#181f2a";
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText(format(parseISO(d), "d MMM yyyy"), P + 8, y + 38);

    slots.forEach((s, i) => {
      const x = colX(i);
      ctx.strokeStyle = "#e8e5dd";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + thisRowH);
      ctx.stroke();

      const person = cellMap[d]?.[s.label];
      const lines = cellLines[i];
      if (!person || !lines) {
        ctx.fillStyle = "#68717e";
        ctx.font = `22px ${FONT}`;
        ctx.fillText("—", x + 12, y + 38);
        return;
      }
      const c = colorFor(person, s.label);
      ctx.font = `600 22px ${FONT}`;
      const textW = Math.max(...lines.map((l) => ctx.measureText(l).width));
      const pillW = Math.min(colW(i) - 16, textW + 24);
      const pillH = lines.length * pillLineH + 10;
      ctx.fillStyle = c.bg;
      ctx.strokeStyle = c.border;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x + 8, y + (thisRowH - pillH) / 2, pillW, pillH, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = c.text;
      lines.forEach((l, li) =>
        ctx.fillText(l, x + 20, y + (thisRowH - pillH) / 2 + 26 + li * pillLineH),
      );
    });

    y += thisRowH;
  });

  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("No image"))), "image/png"),
  );
}
