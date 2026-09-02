import { queryOptions, useQuery } from "@tanstack/react-query";
import { getOwnEmployee, type OwnEmployee } from "@/lib/employee.functions";

export const currentEmployeeQuery = queryOptions({
  queryKey: ["current-employee"],
  queryFn: (): Promise<OwnEmployee> => getOwnEmployee(),
  staleTime: 5 * 60 * 1000,
});

/** Colaborador logado — alimenta o avatar do header, o perfil e a integração. */
export function useCurrentEmployee() {
  return useQuery(currentEmployeeQuery);
}

/** Iniciais para o avatar de fallback: primeiro e último nome, no máximo duas letras. */
export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "WG";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
