import { createContext, useContext } from "react";

/** Busca da topbar do painel — filtra a seção aberta. */
export const AdminSearchContext = createContext<{ term: string; setTerm: (v: string) => void }>({
  term: "",
  setTerm: () => {},
});

export function useAdminSearch() {
  return useContext(AdminSearchContext);
}
