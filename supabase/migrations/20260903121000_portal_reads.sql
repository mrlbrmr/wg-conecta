-- Leitura de contatos pelo portal
--
-- `contacts` era admin-only desde o hardening de 2026-07-10, então a tela de
-- G&G só conseguia mostrar a equipe através de uma server function pública com
-- service role — que expunha os dados a quem chamasse a rota sem sessão.
-- Com esta policy o portal lê os contatos ativos com o próprio JWT, e aquele
-- endpoint some.

DROP POLICY IF EXISTS contacts_portal_read ON public.contacts;
CREATE POLICY contacts_portal_read ON public.contacts
  FOR SELECT TO authenticated
  USING (active = true OR app_private.is_admin(auth.uid()));
