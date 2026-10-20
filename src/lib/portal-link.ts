const PUBLIC_ORIGIN = "https://the-rock-roster.lovable.app";

export function portalUrl(id: string): string {
  return `${PUBLIC_ORIGIN}/my-roster?id=${encodeURIComponent(id)}`;
}

/** Normalise a South African-style number to WhatsApp's international digits. */
export function waDigits(phone: string): string {
  let d = (phone || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "27" + d.slice(1);
  return d;
}

export function portalWhatsappUrl(name: string, phone: string, id: string): string {
  const first = (name || "").trim().split(/\s+/)[0] || "there";
  const msg = `Hi ${first}! ⛰️\n\nHere is your personal link to view your Rock Church serving dates, mark dates you're away, or update your contact details:\n\n👉 ${portalUrl(id)}`;
  return `https://wa.me/${waDigits(phone)}?text=${encodeURIComponent(msg)}`;
}
