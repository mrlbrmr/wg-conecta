/**
 * Datas de cultura — aniversário e tempo de casa.
 *
 * Regra: nada aqui é armazenado. Tempo de casa, dias até o aniversário e marcos
 * são sempre derivados de `birth_date` / `admission_date` no momento da leitura.
 */

export const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export const MONTHS_SHORT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** Hoje à meia-noite local — base de todos os cálculos. */
export function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Dias até a próxima ocorrência de dia/mês da data ISO. 0 = hoje. */
export function daysUntilBirthday(iso: string): number {
  const t = today();
  const [, m, d] = iso.split("-");
  const month = parseInt(m, 10) - 1;
  const day = parseInt(d, 10);
  let next = new Date(t.getFullYear(), month, day);
  if (next < t) next = new Date(t.getFullYear() + 1, month, day);
  return Math.round((next.getTime() - t.getTime()) / 86400000);
}

export type Tenure = { years: number; months: number; total: number };

/** Anos e meses corridos desde a admissão. `total` em meses, para ordenar. */
export function calcTenure(iso: string): Tenure {
  const t = today();
  const start = new Date(iso + "T00:00:00");
  let years = t.getFullYear() - start.getFullYear();
  let months = t.getMonth() - start.getMonth();
  if (t.getDate() < start.getDate()) months--;
  if (months < 0) { years--; months += 12; }
  return { years, months, total: years * 12 + months };
}

/** "7 anos e 2 meses" — omite a parte zerada. */
export function tenureLabel(t: Tenure): string {
  const parts: string[] = [];
  if (t.years > 0) parts.push(`${t.years} ${t.years === 1 ? "ano" : "anos"}`);
  if (t.months > 0) parts.push(`${t.months} ${t.months === 1 ? "mês" : "meses"}`);
  return parts.length > 0 ? parts.join(" e ") : "menos de 1 mês";
}

/** Marco redondo (5, 10, 15…) completado no mês corrente. */
export function isMilestone(t: Tenure, admissionIso: string): boolean {
  return t.years >= 5 && t.years % 5 === 0 && isAnniversaryMonth(admissionIso);
}

/** O mês de admissão é o mês corrente. */
export function isAnniversaryMonth(admissionIso: string): boolean {
  return parseInt(admissionIso.split("-")[1], 10) - 1 === today().getMonth();
}

/** Iniciais: primeira letra do primeiro e do último nome com mais de 2 letras. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter((w) => w.length > 2);
  if (parts.length === 0) return name.trim().slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** ISO → dd/mm/aaaa */
export function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** ISO → "3 de set" */
export function birthdayLabel(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${parseInt(d, 10)} de ${MONTHS_SHORT[parseInt(m, 10) - 1]}`;
}

/** Mês (0-11) da data ISO. */
export function monthOf(iso: string): number {
  return parseInt(iso.split("-")[1], 10) - 1;
}
