/**
 * Cargo como o portal mostra: sem senioridade ("Analista Financeiro Pleno" → "Analista
 * Financeiro", "Auxiliar de Logística II" → "Auxiliar de Logística").
 *
 * O cargo completo continua no cadastro (é dado do DP) e só aparece no formulário de edição
 * do painel. Portal e painel mostram tudo sem o nível. A mesma regra está em SQL na view
 * `employee_directory` (migration `20260915120100_directory_public_job_title.sql`) — mudou
 * aqui, muda lá.
 */

/** Palavras de nível, em qualquer posição: Jr, Júnior, Pl, Pleno, Sr, Sênior, Trainee. */
const LEVEL_WORD = /(?<![\p{L}\p{N}])(jr|j[uú]nior|pl|pleno|sr|s[eê]nior|trainee)(?![\p{L}\p{N}])\.?/giu;

/** Nível no fim: I, II, III, IV ou "Nível 2". */
const TRAILING_LEVEL = /\s+(i{1,3}|iv|n[ií]vel\s*\S+)\s*$/iu;

export function publicJobTitle(title: string | null | undefined): string | null {
  if (!title) return title ?? null;
  const cleaned = title
    .replace(LEVEL_WORD, "")
    .replace(/\(\s*\)/g, "")
    .replace(TRAILING_LEVEL, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[\s\-–/|,.]+$/u, "")
    .trim();
  // Se o cargo era só o nível, melhor mostrar como veio do que mostrar nada.
  return cleaned || title;
}

/**
 * Coordenação e supervisão entram em "Colegas da área", mesmo quando são a gestão direta.
 * Encarregado fica de fora de propósito, ainda que o cargo cite supervisão.
 */
export function isTeamLead(title: string | null | undefined): boolean {
  if (!title) return false;
  const key = title.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  if (key.includes("encarregad")) return false;
  return /(?<![a-z])(coordenador|supervisor)a?(?![a-z])/.test(key);
}
