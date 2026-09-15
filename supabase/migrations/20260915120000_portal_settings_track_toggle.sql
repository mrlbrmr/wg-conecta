-- Interruptor da trilha de integração
--
-- O G&G quer poder tirar a trilha do ar por um tempo sem apagar os itens nem o progresso de
-- ninguém. Desligada, o portal esconde a aba "Trilha" do perfil e o checklist, o percentual e a
-- linha do tempo da Integração. Vídeos, materiais e "Quem é quem" continuam.
--
-- `portal_settings` já é lida por todo o portal e editada só por admin
-- (`portal_settings_admin_write`, 20260710111950), então não há policy nova.

ALTER TABLE public.portal_settings
  ADD COLUMN IF NOT EXISTS onboarding_track_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.portal_settings.onboarding_track_enabled IS
  'Trilha de integração visível no portal. false esconde a aba do perfil e o progresso da Integração.';
