/**
 * Casamento de nomes entre a planilha do DP e o diretório.
 *
 * Fica fora de `employee.functions.ts` porque as duas pontas precisam da mesma
 * regra: o servidor decide o que grava, e a prévia da importação precisa mostrar
 * antes exatamente o que vai acontecer. Regras diferentes nas duas pontas seria
 * pior do que não ter prévia.
 */

/** Palavras funcionais que não ajudam a identificar ninguém. */
const STOP_WORDS = new Set(["da", "de", "do", "das", "dos", "e", "a", "o", "em", "di"]);

/** Minúsculo, sem acento, sem pontuação, espaços comprimidos. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Palavras de conteúdo do nome já normalizado. */
export function nameTokens(normalized: string): string[] {
  return normalized.split(" ").filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Encontra quem, no diretório, é a mesma pessoa do nome vindo da planilha.
 *
 * A planilha escreve o nome de um jeito e o cadastro de outro ("Jose Mendes"
 * contra "José Luiz Mendes"), então o casamento vai afrouxando em etapas — e só
 * aceita o resultado quando ele é único. Na dúvida devolve `null`, e a linha
 * entra como pessoa nova: duplicata dá para apagar, escrever no cadastro de
 * outra pessoa não dá para desfazer.
 */
export function matchByName<T extends { name: string }>(name: string, pool: T[]): T | null {
  const norm = normalizeName(name);
  if (!norm) return null;
  const words = nameTokens(norm);

  const unique = (list: T[]) => (list.length === 1 ? list[0] : null);

  // 1) Nome completo idêntico.
  const exact = pool.filter((e) => normalizeName(e.name) === norm);
  if (exact.length > 0) return exact[0];
  if (words.length === 0) return null;

  // 2) Primeiro e último nome coincidem ("Jose Benvindo" → "Jose Willian da Silva Benvindo").
  if (words.length >= 2) {
    const first = words[0];
    const last = words[words.length - 1];
    const byEnds = unique(
      pool.filter((e) => {
        const w = normalizeName(e.name).split(" ");
        return w[0] === first && w[w.length - 1] === last;
      }),
    );
    if (byEnds) return byEnds;
  }

  // 3) Todas as palavras da planilha cabem no nome cadastrado…
  const bySubset = unique(
    pool.filter((e) => {
      const w = normalizeName(e.name).split(" ");
      return words.every((x) => w.includes(x));
    }),
  );
  if (bySubset) return bySubset;

  // …ou o contrário, quando o cadastro tem o nome mais curto.
  const bySuperset = unique(
    pool.filter((e) => {
      const w = nameTokens(normalizeName(e.name));
      return w.length >= 2 && w.every((x) => words.includes(x));
    }),
  );
  if (bySuperset) return bySuperset;

  // 4) Só um primeiro nome na planilha: aceita se não houver homônimo.
  if (words.length === 1) {
    return unique(pool.filter((e) => normalizeName(e.name).split(" ")[0] === words[0]));
  }

  return null;
}

/** Campos que a importação pode preencher — nunca sobrescreve o que já existe. */
export const IMPORTABLE_FIELDS = [
  ["email", "e-mail"],
  ["phone", "telefone"],
  ["birth_date", "nascimento"],
  ["admission_date", "admissão"],
  ["department", "área"],
  ["job_title", "cargo"],
  ["unit", "unidade"],
] as const;

export type ImportableField = (typeof IMPORTABLE_FIELDS)[number][0];

/**
 * O que esta linha da planilha completaria no cadastro de `target`.
 * Devolve só os campos que a planilha traz e o cadastro ainda não tem.
 */
export function fieldsToFill(
  row: Partial<Record<ImportableField, string | undefined>>,
  target: Partial<Record<ImportableField, string | null>>,
): ImportableField[] {
  return IMPORTABLE_FIELDS.filter(([key]) => Boolean(row[key]) && !target[key]).map(([key]) => key);
}

/** Rótulo em português dos campos, para a prévia da importação. */
export function fieldLabel(key: ImportableField): string {
  return IMPORTABLE_FIELDS.find(([k]) => k === key)![1];
}
