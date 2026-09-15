import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

/**
 * Matriz de contatos: para cada assunto, quem atende cada departamento.
 * Linha sem departamento ("" ou NULL) vale para todos.
 */
export type MatrixRow = Tables<"contact_matrix">;

export const contactMatrixQuery = queryOptions({
  queryKey: ["contact_matrix"],
  queryFn: async (): Promise<MatrixRow[]> => {
    const { data, error } = await supabase
      .from("contact_matrix")
      .select("*")
      .eq("active", true)
      .order("order_index")
      .order("subject");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
});

const isGeneral = (r: MatrixRow) => !r.department?.trim();

/** Mesmo departamento, sem diferença de caixa, acento ou espaço. */
function sameDepartment(a: string | null | undefined, b: string | null | undefined): boolean {
  const fold = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ").trim();
  return Boolean(a && b && fold(a) === fold(b));
}

/**
 * Os contatos que valem para um departamento, agrupados por assunto na ordem do G&G.
 * Onde a área tem contato próprio, ele substitui o geral; onde não tem, fica o geral.
 */
export function matrixFor(rows: MatrixRow[], department: string | null | undefined) {
  const subjects = new Map<string, { subject: string; specific: MatrixRow[]; general: MatrixRow[] }>();
  for (const r of rows) {
    const key = r.subject.trim();
    const entry = subjects.get(key) ?? { subject: key, specific: [], general: [] };
    if (isGeneral(r)) entry.general.push(r);
    else if (sameDepartment(r.department, department)) entry.specific.push(r);
    subjects.set(key, entry);
  }
  return [...subjects.values()]
    .map((s) => ({
      subject: s.subject,
      contacts: s.specific.length > 0 ? s.specific : s.general,
      specific: s.specific.length > 0,
    }))
    .filter((s) => s.contacts.length > 0);
}

/** Departamentos que têm alguma linha própria na matriz, para o seletor "ver outra área". */
export function matrixDepartments(rows: MatrixRow[]): string[] {
  const seen = new Map<string, string>();
  for (const r of rows) {
    const d = r.department?.trim();
    if (d && !seen.has(d.toLowerCase())) seen.set(d.toLowerCase(), d);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
