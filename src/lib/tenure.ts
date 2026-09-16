/** Tempo de casa e datas — sempre derivados da admissão, nunca armazenados. */

/** Anos completos desde a data (admissão ou aniversário de casa). */
export function yearsSince(date: string | null | undefined): number {
  if (!date) return 0;
  const d = parseISODate(date);
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  const monthDelta = now.getMonth() - d.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < d.getDate())) years--;
  return Math.max(0, years);
}

/**
 * Anos que a pessoa completa no aniversário de casa do ano dado — não na data de hoje.
 * Em setembro, quem entrou em 30/09/2025 "faz 1 ano" o mês inteiro, inclusive no dia 1º.
 */
export function yearsOnAnniversary(date: string, year = new Date().getFullYear()): number {
  return Math.max(0, year - parseISODate(date).getFullYear());
}

/**
 * Marcos de tempo de casa que o portal parabeniza: 3, 5, 7 e 10 anos e, depois, de 5 em 5
 * (15, 20, 25…).
 */
export function isTenureMilestone(years: number): boolean {
  if (years <= 10) return years === 3 || years === 5 || years === 7 || years === 10;
  return years % 5 === 0;
}

/** Anos e meses completos desde a data. */
export function tenureFrom(date: string | null | undefined): { years: number; months: number } {
  if (!date) return { years: 0, months: 0 };
  const d = parseISODate(date);
  const now = new Date();
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months--;
  months = Math.max(0, months);
  return { years: Math.floor(months / 12), months: months % 12 };
}

/** "2 anos e 6 meses de casa", "8 meses de casa", "Chegou este mês". */
export function tenureLabel(date: string | null | undefined, suffix = " de casa"): string {
  if (!date) return "—";
  const { years, months } = tenureFrom(date);
  if (years === 0 && months === 0) return "Chegou este mês";
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? "ano" : "anos"}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? "mês" : "meses"}`);
  return parts.join(" e ") + suffix;
}

/** Data ISO (`aaaa-mm-dd`) lida como local, sem o deslocamento de fuso do `new Date`. */
export function parseISODate(date: string): Date {
  const iso = date.length > 10 ? date.slice(0, 10) : date;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** `dd/mm/aaaa` — formato de data do portal. */
export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return parseISODate(date).toLocaleDateString("pt-BR");
}

/** `dd/mm` — aniversário nunca mostra o ano. */
export function formatDayMonth(day: number | null, month: number | null): string {
  if (!day || !month) return "—";
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}

export const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

/** "setembro de 2026" — usado nos kickers das telas de Cultura e Mural. */
export function monthLabel(date = new Date()): string {
  return `${MONTHS[date.getMonth()]} de ${date.getFullYear()}`;
}
