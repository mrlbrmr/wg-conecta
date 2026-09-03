/** Helpers visuais compartilhados pelas telas que listam colaboradores. */

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-pink-100 text-pink-700",
  "bg-amber-100 text-amber-700",
  "bg-teal-100 text-teal-700",
  "bg-indigo-100 text-indigo-700",
  "bg-rose-100 text-rose-700",
  "bg-emerald-100 text-emerald-700",
];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function avatarColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** Data ISO (yyyy-mm-dd) para dd/mm/yyyy ou dd/mm. */
export function fmtDate(iso: string | null, mode: "dd/mm" | "dd/mm/yyyy" = "dd/mm/yyyy") {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  if (!d || !m) return null;
  return mode === "dd/mm" ? `${d}/${m}` : `${d}/${m}/${y}`;
}

/** Timestamptz para dd/mm/yyyy às hh:mm. */
export function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
