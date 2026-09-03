import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type MonthlyDeadline = Tables<"monthly_deadlines">;

function ensureList<T>(res: { data: T[] | null; error: { message: string } | null }): T[] {
  if (res.error) throw new Error(res.error.message);
  return res.data ?? [];
}

/** Prazos combinados do mês — folha, atestados, adesões. */
export const monthlyDeadlinesQuery = queryOptions({
  queryKey: ["monthly_deadlines"],
  queryFn: async (): Promise<MonthlyDeadline[]> =>
    ensureList(
      await supabase
        .from("monthly_deadlines")
        .select("*")
        .eq("active", true)
        .order("due_date")
        .order("order_index"),
    ),
});

/** Prazos do mês de referência, do mais próximo para o mais distante. */
export function deadlinesInMonth(rows: MonthlyDeadline[], date = new Date()) {
  const prefix = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  return rows.filter((d) => d.due_date.startsWith(prefix));
}

/**
 * Estado do prazo em relação a hoje.
 * `vencido` e `hoje` pintam de verde na tabela do admin; `no-prazo` fica muted.
 */
export function deadlineState(due: string | null): "vencido" | "hoje" | "no-prazo" | "sem-prazo" {
  if (!due) return "sem-prazo";
  const today = new Date().toISOString().slice(0, 10);
  if (due < today) return "vencido";
  if (due === today) return "hoje";
  return "no-prazo";
}
