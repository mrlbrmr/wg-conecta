-- Desfaz o que `supabase/setup_completo.sql` reabriu ao ser rodado depois das migrations.
--
-- Conferido em 11/09/2026: `pg_policies` tinha as `*_write_auth` (FOR ALL TO authenticated
-- USING (true)), que a `20260710111950` tinha trocado por `*_admin_write`. Como policies
-- permissivas se somam com OR, qualquer colaborador logado podia criar, editar e apagar
-- comunicados, benefícios, documentos, FAQ, vagas, formulários etc. direto pela API.
--
-- O mesmo script também:
--   - reabriu a leitura de `birthdays`, `work_anniversaries` e `contacts` (tabelas legadas);
--   - recriou as policies "próprio registro" de `employees` com `id = auth.uid()` (critério de
--     antes do desacoplamento em `20260818140000`);
--   - devolveu `UPDATE` na tabela `employees` inteira, desfazendo o GRANT por coluna de
--     `20260903120100` — o colaborador podia mudar setor, cargo, `active` e nascimento;
--   - recriou `app_private.is_employee` com `id = uid`.
--
-- Idempotente: pode rodar mais de uma vez. Nada no app depende do que sai daqui — o painel
-- escreve pelas `*_admin_write` e todas as escritas em `employees` usam a service role.

-- ── 1. Escrita aberta a qualquer autenticado ─────────────────────────
DROP POLICY IF EXISTS portal_settings_write_auth ON public.portal_settings;
DROP POLICY IF EXISTS quick_links_write_auth     ON public.quick_links;
DROP POLICY IF EXISTS announcements_write_auth   ON public.announcements;
DROP POLICY IF EXISTS benefits_write_auth        ON public.benefits;
DROP POLICY IF EXISTS documents_write_auth       ON public.documents;
DROP POLICY IF EXISTS faq_write_auth             ON public.faq_items;
DROP POLICY IF EXISTS jobs_write_auth            ON public.internal_jobs;
DROP POLICY IF EXISTS onboarding_write_auth      ON public.onboarding_materials;
DROP POLICY IF EXISTS forms_write_auth           ON public.forms;
DROP POLICY IF EXISTS birthdays_write_auth       ON public.birthdays;
DROP POLICY IF EXISTS wa_write_auth              ON public.work_anniversaries;
DROP POLICY IF EXISTS rec_write_auth             ON public.recognitions;
DROP POLICY IF EXISTS camp_write_auth            ON public.campaigns;
DROP POLICY IF EXISTS contacts_write_auth        ON public.contacts;
DROP POLICY IF EXISTS gg_pages_write_auth        ON public.gg_pages;

-- ── 2. Escrita do admin: garante que as policies certas existem ──────
-- Recriadas do jeito da `20260710111950`, caso alguma tenha se perdido no caminho.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    ('portal_settings',      'portal_settings_admin_write'),
    ('quick_links',          'quick_links_admin_write'),
    ('announcements',        'announcements_admin_write'),
    ('benefits',             'benefits_admin_write'),
    ('documents',            'documents_admin_write'),
    ('faq_items',            'faq_admin_write'),
    ('internal_jobs',        'jobs_admin_write'),
    ('onboarding_materials', 'onboarding_admin_write'),
    ('forms',                'forms_admin_write'),
    ('birthdays',            'birthdays_admin_write'),
    ('work_anniversaries',   'wa_admin_write'),
    ('recognitions',         'rec_admin_write'),
    ('campaigns',            'camp_admin_write'),
    ('contacts',             'contacts_admin_write'),
    ('gg_pages',             'gg_pages_admin_write')
  ) AS v(tbl, pol)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t.pol, t.tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
      'USING (app_private.is_admin(auth.uid())) WITH CHECK (app_private.is_admin(auth.uid()))',
      t.pol, t.tbl);
  END LOOP;
END $$;

-- ── 3. Leitura das tabelas legadas volta a ser só do admin ───────────
-- O portal lê aniversários e tempo de casa de `employee_directory`, não daqui. `contacts`
-- continua legível para autenticados por `contacts_portal_read` (`20260903121000`).
DROP POLICY IF EXISTS birthdays_read_active ON public.birthdays;
DROP POLICY IF EXISTS wa_read_active        ON public.work_anniversaries;
DROP POLICY IF EXISTS contacts_read_active  ON public.contacts;

DROP POLICY IF EXISTS birthdays_admin_read ON public.birthdays;
CREATE POLICY birthdays_admin_read ON public.birthdays FOR SELECT TO authenticated
  USING (app_private.is_admin(auth.uid()));
DROP POLICY IF EXISTS wa_admin_read ON public.work_anniversaries;
CREATE POLICY wa_admin_read ON public.work_anniversaries FOR SELECT TO authenticated
  USING (app_private.is_admin(auth.uid()));

-- ── 4. employees: próprio registro por auth_user_id, UPDATE só por coluna ──
DROP POLICY IF EXISTS employees_self_read ON public.employees;
CREATE POLICY employees_self_read ON public.employees FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS employees_self_update ON public.employees;
CREATE POLICY employees_self_update ON public.employees FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- RLS não filtra coluna: quem faz isso é o GRANT (ver `20260903120100`).
REVOKE INSERT, UPDATE, DELETE ON public.employees FROM authenticated;
GRANT UPDATE (bio, extension, email, photo_url, updated_at) ON public.employees TO authenticated;

CREATE OR REPLACE FUNCTION app_private.is_employee(uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.employees WHERE auth_user_id = uid AND active = true);
$$;
