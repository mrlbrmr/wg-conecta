import { useQuery } from "@tanstack/react-query";
import { portalSettingsQuery } from "@/lib/portal-queries";

/**
 * A trilha de integração pode ser desligada em Configurações. Desligada, somem a aba
 * "Trilha" do perfil e o checklist, o percentual e a linha do tempo da Integração.
 * Enquanto a configuração carrega (ou se a coluna ainda não existir), vale "ligada".
 */
export function useTrackEnabled(): boolean {
  const settings = useQuery(portalSettingsQuery);
  return settings.data?.onboarding_track_enabled !== false;
}
