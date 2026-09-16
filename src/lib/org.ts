/**
 * Filiais e setores oficiais do Grupo WG — a mesma lista do formulário do SIM
 * (Sistema Interno de Melhorias). Fonte única para a importação da planilha, o
 * cadastro de colaboradores e os formulários do portal.
 *
 * Lembrete da semântica em `employees`: `unit` = filial (onde a pessoa trabalha),
 * `department` = setor/área (o que ela faz).
 */

export const UNITS = [
  "Campinas/SP",
  "Maringá/PR",
  "Nova Iguaçu/RJ",
  "São Bernardo do Campo/SP",
  "São José dos Pinhais/PR",
  "São Paulo/SP",
  "Sumaré/SP",
] as const;

export const DEPARTMENTS = [
  "Assistência Técnica",
  "Comercial",
  "Faturamento",
  "Financeiro",
  "Gestão de Pessoas",
  "Logística",
] as const;

/** Minúsculo, sem acento e só letras e dígitos: "São José dos Pinhais/PR" → "saojosedospinhaispr". */
function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Pedaços que identificam cada filial, na forma de `fold`. */
const UNIT_ALIASES: [string, (typeof UNITS)[number]][] = [
  ["campinas", "Campinas/SP"],
  ["maringa", "Maringá/PR"],
  ["novaiguacu", "Nova Iguaçu/RJ"],
  ["saobernardo", "São Bernardo do Campo/SP"],
  ["sbc", "São Bernardo do Campo/SP"],
  ["saojosedospinhais", "São José dos Pinhais/PR"],
  ["sjp", "São José dos Pinhais/PR"],
  ["saopaulo", "São Paulo/SP"],
  ["sumare", "Sumaré/SP"],
];

/** Siglas da planilha do DP. Só valem sozinhas: "sp" como pedaço casaria com "Campinas/SP". */
const UNIT_CODES = new Map<string, (typeof UNITS)[number]>([
  ["rj", "Nova Iguaçu/RJ"],
  ["sp", "São Paulo/SP"],
  ["sum", "Sumaré/SP"],
]);

/**
 * Filial no nome oficial. Reconhece variações da planilha ("SAO JOSE DOS PINHAIS",
 * "Filial Campinas", "SJP", "RJ", "SUM"); o que não reconhece volta como veio, para não
 * perder o dado.
 */
export function normalizeUnit(raw: unknown): string | undefined {
  const value = raw == null ? "" : String(raw).trim();
  if (!value) return undefined;
  const key = fold(value);
  const byCode = UNIT_CODES.get(key);
  if (byCode) return byCode;
  return UNIT_ALIASES.find(([alias]) => key.includes(alias))?.[1] ?? value;
}

const DEPARTMENT_ALIASES = new Map<string, (typeof DEPARTMENTS)[number]>([
  ...DEPARTMENTS.map((d) => [fold(d), d] as const),
  ["assistencia", "Assistência Técnica"],
  ["at", "Assistência Técnica"],
  ["vendas", "Comercial"],
  ["gentegestao", "Gestão de Pessoas"],
  ["gg", "Gestão de Pessoas"],
  ["rh", "Gestão de Pessoas"],
  ["recursoshumanos", "Gestão de Pessoas"],
  ["logistica", "Logística"],
]);

/** Setor no nome oficial quando é um dos conhecidos; os demais voltam como vieram. */
export function normalizeDepartment(raw: unknown): string | undefined {
  const value = raw == null ? "" : String(raw).trim();
  if (!value) return undefined;
  return DEPARTMENT_ALIASES.get(fold(value)) ?? value;
}
