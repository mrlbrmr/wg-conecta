import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentEmployee } from "@/hooks/use-current-employee";
import { directoryQuery } from "@/lib/directory-queries";

/** Quem está preenchendo o formulário, resolvido do cadastro. */
export interface Identity {
  employeeId: string;
  name: string;
  registration_number: string;
  department: string;
  manager_name: string;
}

/**
 * Identificação para os formulários de G&G.
 *
 * Nome, setor e gestor vêm do DP e ficam somente-leitura na tela — o caminho
 * para corrigir é a Atualização Cadastral, não o formulário que a pessoa está
 * preenchendo. A matrícula só é editável enquanto o cadastro ainda não a tiver.
 *
 * O nome do gestor sai do diretório (`employee_directory`), que é a projeção
 * sem dado sensível — `manager_id` sozinho não diz nada para quem preenche.
 */
export function useIdentity() {
  const me = useCurrentEmployee();
  const directory = useQuery(directoryQuery);

  const identity = useMemo<Identity>(() => {
    const e = me.data;
    const manager = e?.manager_id
      ? (directory.data ?? []).find((d) => d.id === e.manager_id)
      : undefined;
    return {
      employeeId: e?.id ?? "",
      name: e?.name ?? "",
      registration_number: e?.registration_number ?? "",
      department: e?.department ?? "",
      manager_name: manager?.name ?? "",
    };
  }, [me.data, directory.data]);

  return {
    identity,
    loading: me.isLoading,
    hasRegistration: Boolean(me.data?.registration_number),
  };
}
