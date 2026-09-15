import * as XLSX from "xlsx";
import { normalizeDepartment, normalizeUnit } from "@/lib/org";

/**
 * Leitura da planilha do DP para a importação de colaboradores.
 *
 * Roda só no navegador: a planilha não sobe inteira — sai daqui só o que o cadastro usa (nome,
 * contato, cargo, filial, setor, datas). Colunas como Salário nem são lidas.
 *
 * Fica fora da tela para dar para testar com planilhas de verdade.
 */

export type ImportRow = {
  name: string;
  email?: string;
  phone?: string;
  department?: string;
  unit?: string;
  job_title?: string;
  admission_date?: string;
  birth_date?: string;
};

export type ParsedSheet = {
  rows: ImportRow[];
  /** Linhas com Situação de desligado — ficam de fora. */
  inactive: number;
  /** Aba e linha (1 = primeira) onde estavam os títulos. */
  sheet?: string;
  headerRow?: number;
};

/** Título de coluna comparável: "Data Nasc." → "datanasc", "ADMISSÃO" → "admissao". */
export function normalizeKey(k: string): string {
  return k.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]/g, "");
}

/** Colunas de nome, em ordem de preferência. "Nome completo" vence "Quem usa" (apelido). */
const NAME_KEYS = [
  "nomecompleto",
  "nomecompletodocolaborador",
  "nome",
  "name",
  "colaborador",
  "quemusai",
  "quemusao",
  "quemusa",
];

/** Onde procurar a linha de títulos: planilhas do DP costumam ter título ou linha vazia no topo. */
const HEADER_SCAN_ROWS = 20;

const LOWER_WORDS = new Set(["da", "de", "do", "das", "dos", "e", "a", "o", "em", "di"]);
/** Siglas que aparecem em cargo e setor e ficam em maiúsculas. */
const ACRONYMS = new Set(["ti", "rh", "sac", "cnh", "nf", "cd", "pcp", "sesmt", "ltda"]);
const ROMAN = /^(i{1,3}|iv|vi{0,3}|ix|x)$/;

/**
 * Título em português: artigos e preposições minúsculos, algarismos romanos e siglas em
 * maiúsculas ("AUXILIAR DE LOGISTICA II" → "Auxiliar de Logistica II", "ANALISTA DE TI").
 */
export function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((w, i) => {
      if (ROMAN.test(w) || ACRONYMS.has(w)) return w.toUpperCase();
      if (i > 0 && LOWER_WORDS.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

/** Serial de data do Excel → "aaaa-mm-dd". */
function xlDateToISO(serial: number): string {
  const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return d.toISOString().split("T")[0];
}

/** "dd/mm/aaaa", "aaaa-mm-dd" ou serial do Excel → "aaaa-mm-dd". */
function parseDateISO(val: unknown): string | undefined {
  if (!val) return undefined;
  if (typeof val === "number") return xlDateToISO(val);
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return undefined;
}

/**
 * Telefone chega como número ("11987654321") ou já mascarado. Guarda com máscara quando dá
 * para reconhecer fixo ou celular; caso contrário, o texto original.
 */
function parsePhone(val: unknown): string | undefined {
  if (val === null || val === undefined || val === "") return undefined;
  const raw = String(val).trim();
  if (!raw) return undefined;
  const d = raw.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length < 8) return undefined;
  return raw.slice(0, 30);
}

/** Situação que tira a pessoa do quadro. Afastado e férias continuam valendo. */
function isInactiveStatus(val: unknown): boolean {
  const s = normalizeKey(String(val ?? ""));
  return /deslig|demit|inativ|rescis|dispens|excluid/.test(s);
}

/**
 * A tabela da aba: acha a linha de títulos (a primeira, no topo, com uma coluna de nome) e
 * devolve as linhas seguintes com as chaves normalizadas. `null` se a aba não tem essa linha.
 */
function readTable(ws: XLSX.WorkSheet): { records: Record<string, unknown>[]; headerRow: number } | null {
  const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", blankrows: true });
  const idx = grid
    .slice(0, HEADER_SCAN_ROWS)
    .findIndex((row) => row.some((cell) => NAME_KEYS.includes(normalizeKey(String(cell ?? "")))));
  if (idx < 0) return null;

  const headers = grid[idx].map((cell) => normalizeKey(String(cell ?? "")));
  const records = grid.slice(idx + 1).map((row) => {
    const rec: Record<string, unknown> = {};
    headers.forEach((key, i) => {
      // Coluna sem título não entra; título repetido fica com a primeira coluna.
      if (key && !(key in rec)) rec[key] = row[i];
    });
    return rec;
  });
  // A linha na planilha: o intervalo da aba pode não começar na linha 1.
  const start = XLSX.utils.decode_range(ws["!ref"] ?? "A1").s.r;
  return { records, headerRow: start + idx + 1 };
}

const pick = (rec: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) {
    const v = rec[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return undefined;
};

export function parseEmployeeWorkbook(wb: XLSX.WorkBook): ParsedSheet {
  for (const sheet of wb.SheetNames) {
    const table = readTable(wb.Sheets[sheet]);
    if (!table) continue;

    let inactive = 0;
    const parsed: ImportRow[] = [];
    for (const rec of table.records) {
      const nome = pick(rec, NAME_KEYS);
      if (typeof nome !== "string" || nome.trim().length < 2) continue;

      if (isInactiveStatus(pick(rec, ["situacao", "status", "situacaoatual"]))) {
        inactive++;
        continue;
      }

      const emailRaw = pick(rec, ["email", "email1", "correioeletronico", "corretoeletronico"]);
      const email = emailRaw
        ? String(emailRaw).trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")
        : undefined;
      const cargo = pick(rec, ["cargo", "jobtitle", "funcao", "funcaocargo", "ocupacao"]);
      // Filial vai para `unit`; setor/área vai para `department`.
      const filial = pick(rec, [
        "filial",
        "filiais",
        "unidade",
        "localdetrabalho",
        "empresa",
        "estabelecimento",
      ]);
      const dept = normalizeDepartment(
        pick(rec, ["setor", "departamento", "depto", "department", "area", "centrodecusto", "centrocusto"]),
      );

      parsed.push({
        name: toTitleCase(nome.trim().replace(/\s+/g, " ")),
        email: email && email.includes("@") ? email : undefined,
        phone: parsePhone(pick(rec, ["telefone", "telefone1", "celular", "whatsapp", "fone", "tel", "contato"])),
        department: dept && toTitleCase(dept),
        unit: normalizeUnit(filial),
        job_title: cargo ? toTitleCase(String(cargo).trim()) : undefined,
        admission_date: parseDateISO(
          pick(rec, [
            "admissao",
            "dtadmissao",
            "dataadmissao",
            "dataadmissaodaempresa",
            "admissaodaempresa",
            "admissiondate",
          ]),
        ),
        birth_date: parseDateISO(
          pick(rec, [
            "datanasc",
            "dtnasc",
            "dtnac",
            "datanascimento",
            "datadenascimento",
            "nascimento",
            "birthdate",
            "datanascimentocompleta",
          ]),
        ),
      });
    }

    // Uma linha por pessoa dentro do arquivo.
    const seen = new Set<string>();
    const rows = parsed.filter((r) => {
      const key = r.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return { rows, inactive, sheet, headerRow: table.headerRow };
  }
  return { rows: [], inactive: 0 };
}
