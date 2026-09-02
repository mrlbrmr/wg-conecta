import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/**
 * Diretório interno — a view `employee_directory` já filtra colaboradores
 * ativos e expõe só colunas não sensíveis (sem e-mail, telefone ou data de
 * nascimento completa; o aniversário sai como dia e mês).
 * Lida com o JWT do próprio usuário: nada de service role aqui.
 */
export type DirectoryEntry = Database["public"]["Views"]["employee_directory"]["Row"];

function ensureList<T>(res: { data: T[] | null; error: { message: string } | null }): T[] {
  if (res.error) throw new Error(res.error.message);
  return res.data ?? [];
}

export async function fetchDirectory(): Promise<DirectoryEntry[]> {
  return ensureList(await supabase.from("employee_directory").select("*").order("name"));
}

export const directoryQuery = queryOptions({
  queryKey: ["employee_directory"],
  queryFn: fetchDirectory,
  staleTime: 5 * 60 * 1000,
});

/** Aniversariantes do ano, em ordem de dia e mês. */
export function birthdaysOf(entries: DirectoryEntry[]): DirectoryEntry[] {
  return entries
    .filter((e) => e.birthday_day && e.birthday_month)
    .sort((a, b) => a.birthday_month! - b.birthday_month! || a.birthday_day! - b.birthday_day!);
}

/** Aniversários de casa, em ordem de mês e dia da admissão. */
export function anniversariesOf(entries: DirectoryEntry[]): DirectoryEntry[] {
  return entries
    .filter((e) => e.admission_date)
    .sort((a, b) => a.admission_date!.slice(5).localeCompare(b.admission_date!.slice(5)));
}
