-- Escritas do colaborador só pelo servidor
--
-- Toda escrita do colaborador passa por server functions (`portal-write.functions.ts`,
-- `profile-request.functions.ts`) que usam a service role, derivam o colaborador do JWT e
-- validam com zod. As policies "próprio registro" abaixo não servem a nenhuma tela — só
-- deixavam a API REST aberta para pular essa validação:
--   - `requests` com `payload`, `priority`, `assignee_id` e `due_date` arbitrários;
--   - `peer_recognitions` com `highlight = true` (virar "Destaque do mês" sozinho);
--   - comentário que o G&G ocultou sendo reativado pelo autor;
--   - `profile_update_requests` com `reviewer_*` preenchido;
--   - `employees.email` trocado sem passar pela Atualização Cadastral.
--
-- A leitura continua como está: as policies de SELECT não são tocadas, e as três "FOR ALL"
-- que também cobriam a leitura própria viram "FOR SELECT". O painel escreve pelas
-- `*_admin_*`, que também não mudam. Uploads de foto e anexo (storage) continuam no
-- navegador e não são afetados.

-- ── Solicitações ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS requests_self_insert                 ON public.requests;
DROP POLICY IF EXISTS request_messages_participant_insert  ON public.request_messages;
DROP POLICY IF EXISTS pur_self_insert                      ON public.profile_update_requests;
DROP POLICY IF EXISTS pur_self_cancel                      ON public.profile_update_requests;

-- ── Cultura e mural ───────────────────────────────────────────────────
DROP POLICY IF EXISTS peer_recognitions_insert_self        ON public.peer_recognitions;
DROP POLICY IF EXISTS announcement_comments_insert_self    ON public.announcement_comments;
DROP POLICY IF EXISTS announcement_comments_update_self    ON public.announcement_comments;
DROP POLICY IF EXISTS announcement_reactions_self_write    ON public.announcement_reactions;
DROP POLICY IF EXISTS anniversary_congrats_self_write      ON public.anniversary_congrats;

-- ── FOR ALL → FOR SELECT (o portal lê essas três pelo navegador) ──────
DROP POLICY IF EXISTS announcement_reads_self ON public.announcement_reads;
DROP POLICY IF EXISTS announcement_reads_self_read ON public.announcement_reads;
CREATE POLICY announcement_reads_self_read ON public.announcement_reads
  FOR SELECT TO authenticated
  USING (employee_id = app_private.current_employee_id());

DROP POLICY IF EXISTS onboarding_progress_self ON public.onboarding_progress;
DROP POLICY IF EXISTS onboarding_progress_self_read ON public.onboarding_progress;
CREATE POLICY onboarding_progress_self_read ON public.onboarding_progress
  FOR SELECT TO authenticated
  USING (employee_id = app_private.current_employee_id());

DROP POLICY IF EXISTS material_views_self ON public.material_views;
DROP POLICY IF EXISTS material_views_self_read ON public.material_views;
CREATE POLICY material_views_self_read ON public.material_views
  FOR SELECT TO authenticated
  USING (employee_id = app_private.current_employee_id());

-- ── employees: nenhuma escrita direta ─────────────────────────────────
-- Bio, ramal e foto são gravados por `updateOwnBio`, `updateOwnContact` e `updateOwnPhoto`
-- (service role). E-mail só muda pela Atualização Cadastral, com aprovação do G&G.
DROP POLICY IF EXISTS employees_self_update ON public.employees;
REVOKE UPDATE (bio, extension, email, photo_url, updated_at) ON public.employees FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.employees FROM authenticated;
