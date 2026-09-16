import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEPARTMENTS } from "@/lib/org";

/**
 * Setores ativos, na ordem do G&G (tabela `departments`, editada em Gente & Gestão → Setores).
 *
 * Se a tabela não responder (migration ainda não rodou, rede), vale a lista fixa de `org.ts`,
 * para os formulários nunca ficarem sem opções.
 */
export const departmentsQuery = queryOptions({
  queryKey: ["departments"],
  queryFn: async (): Promise<string[]> => {
    const { data, error } = await supabase
      .from("departments")
      .select("name")
      .eq("active", true)
      .order("order_index")
      .order("name");
    if (error || !data || data.length === 0) return [...DEPARTMENTS];
    return data.map((d) => d.name);
  },
  staleTime: 5 * 60 * 1000,
});

/** Nomes dos setores ativos. Enquanto carrega, a lista fixa. */
export function useDepartments(): string[] {
  const q = useQuery(departmentsQuery);
  return q.data ?? [...DEPARTMENTS];
}
