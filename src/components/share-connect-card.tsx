import { useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { DiscipleshipRow } from "@/lib/sheets.functions";

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n/)) {
    let line = "";
    for (const w of para.split(" ")) {
      const t = line ? `${line} ${w}` : w;
      if (ctx.measureText(t).width > max && line) {
        out.push(line);
        line = w;
      } else line = t;
    }
    out.push(line);
  }
  return out;
}

function cssVar(name: string, fallback: string) {
  const el = document.createElement("div");
  el.style.color = `var(${name})`;
  document.body.appendChild(el);
  const c = getComputedStyle(el).color;
  el.remove();
  return c || fallback;
}

/** Draws a connect card as a PNG for sending to ministry leaders. */
export async function renderConnectCard(row: DiscipleshipRow): Promise<Blob> {
  const W = 1080;
  const P = 72;
  const scratch = document.createElement("canvas").getContext("2d")!;
  const font = "system-ui, -apple-system, Segoe UI, sans-serif";
  scratch.font = `30px ${font}`;
  const notes = row.notes ? wrap(scratch, row.notes, W - P * 2) : [];

  const fields: [string, string][] = [
    ["Phone", row.phone],
    ["Email", row.email],
    ["Connected", [row.date_connected, row.source].filter(Boolean).join(" · ")],
    ["Birthday", row.birthday],
    ["Follow-up by", row.assigned_to],
  ].filter(([, v]) => v) as [string, string][];

  // pre-layout interest chips
  scratch.font = `600 30px ${font}`;
  const chipRows: { text: string; w: number }[][] = [[]];
  let x = 0;
  for (const i of row.interests) {
    const w = scratch.measureText(i).width + 48;
    if (x + w > W - P * 2 && x > 0) {
      chipRows.push([]);
      x = 0;
    }
    chipRows[chipRows.length - 1].push({ text: i, w });
    x += w + 14;
  }

  const H =
    P + 50 + 90 + 40 + fields.length * 78 +
    (row.interests.length ? 70 + chipRows.length * 74 : 0) +
    (notes.length ? 70 + notes.length * 44 : 0) + P + 40;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const fg = cssVar("--foreground", "#111");
  const muted = cssVar("--muted-foreground", "#666");
  const primary = cssVar("--primary", "#222");
  const bg = cssVar("--card", "#fff");
  const accent = cssVar("--muted", "#f2f2f2");

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, W, 12);

  let y = P + 20;
  ctx.fillStyle = muted;
  ctx.font = `600 26px ${font}`;
  ctx.fillText("THE ROCK CHURCH · CONNECT CARD", P, y);
  y += 90;
  ctx.fillStyle = fg;
  ctx.font = `700 64px ${font}`;
  ctx.fillText(row.person_name, P, y);
  y += 40;

  for (const [k, v] of fields) {
    y += 40;
    ctx.fillStyle = muted;
    ctx.font = `24px ${font}`;
    ctx.fillText(k.toUpperCase(), P, y);
    y += 38;
    ctx.fillStyle = fg;
    ctx.font = `32px ${font}`;
    ctx.fillText(v, P, y);
  }

  if (row.interests.length) {
    y += 70;
    ctx.fillStyle = muted;
    ctx.font = `24px ${font}`;
    ctx.fillText("INTERESTED IN", P, y);
    y += 20;
    ctx.font = `600 30px ${font}`;
    for (const r of chipRows) {
      let cx = P;
      for (const c of r) {
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.roundRect(cx, y, c.w, 58, 29);
        ctx.fill();
        ctx.fillStyle = fg;
        ctx.fillText(c.text, cx + 24, y + 40);
        cx += c.w + 14;
      }
      y += 74;
    }
  }

  if (notes.length) {
    y += 50;
    ctx.fillStyle = muted;
    ctx.font = `24px ${font}`;
    ctx.fillText("NOTES", P, y);
    ctx.fillStyle = fg;
    ctx.font = `30px ${font}`;
    for (const l of notes) {
      y += 44;
      ctx.fillText(l, P, y);
    }
  }

  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("No image"))), "image/png"));
}

export function ShareConnectCardButton({ row }: { row: DiscipleshipRow }) {
  const [busy, setBusy] = useState(false);
  const fileName = `${row.person_name.replace(/\s+/g, "-")}-connect-card.png`;

  const copy = async () => {
    setBusy(true);
    // Start drawing now and hand the promise to the clipboard inside the tap,
    // so iPhone Safari allows the copy.
    const blobPromise = renderConnectCard(row);
    try {
      if (navigator.clipboard && "ClipboardItem" in window) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })]);
        toast.success("Image copied — open WhatsApp and paste.");
        return;
      }
      throw new Error("no clipboard");
    } catch {
      try {
        const blob = await blobPromise;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
        toast.success("Couldn't copy here, so the image was saved instead.");
      } catch {
        toast.error("Couldn't make the card image.");
      }
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    try {
      const blob = await renderConnectCard(row);
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: row.person_name });
      } else {
        toast.error("Sharing isn't available here — use Copy image.");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Couldn't share the image.");
    }
  };

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={copy} disabled={busy}>
        <Copy className="h-4 w-4" /> {busy ? "Copying…" : "Copy image"}
      </Button>
      <Button size="sm" variant="ghost" onClick={share} aria-label="Share image">
        <Share2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
