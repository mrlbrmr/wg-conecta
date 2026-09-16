-- Avisos por e-mail aos colaboradores
--
-- 1. Interruptor em Configurações: `employee_emails_enabled = false` corta todos os e-mails a
--    colaboradores (resposta de solicitação, pedido cadastral decidido, comunicado novo). Os
--    avisos ao G&G não passam por ele. `portal_settings` já é lida por todos e escrita só por
--    admin, então não há policy nova.
-- 2. `announcements.email_sent_at`: marca que o comunicado já foi avisado por e-mail, para que
--    salvar de novo não reenvie. O servidor grava com `WHERE email_sent_at IS NULL`.
--
-- Idempotente.

ALTER TABLE public.portal_settings
  ADD COLUMN IF NOT EXISTS employee_emails_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.portal_settings.employee_emails_enabled IS
  'E-mails automáticos aos colaboradores. false desliga todos (os avisos ao G&G continuam).';

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.announcements.email_sent_at IS
  'Quando o aviso por e-mail do comunicado foi disparado. Nulo = ainda não avisado.';
