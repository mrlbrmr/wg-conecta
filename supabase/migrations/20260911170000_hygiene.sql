-- Higiene de acesso
--
-- 1. `portal_access` é do tempo do código de acesso compartilhado ("WGBaterias2026"), trocado
--    por login individual. Nada no app lê a tabela; ela só guardava o hash do código antigo.
-- 2. As policies de leitura de conteúdo não diziam `TO authenticated`. O `anon` só não lia
--    porque não tem EXECUTE em `app_private.is_admin()` — e recebia erro em vez de nada. Com o
--    papel explícito, visitante sem login simplesmente não enxerga linha nenhuma.

DROP TABLE IF EXISTS public.portal_access;

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN SELECT * FROM (VALUES
    ('quick_links',          'quick_links_read_active'),
    ('benefits',             'benefits_read_active'),
    ('documents',            'documents_read_active'),
    ('faq_items',            'faq_read_active'),
    ('forms',                'forms_read_active'),
    ('onboarding_materials', 'onboarding_read_active'),
    ('campaigns',            'camp_read_active'),
    ('gg_pages',             'gg_pages_read_active'),
    ('recognitions',         'rec_read_active'),
    ('announcements',        'announcements_read_pub'),
    ('internal_jobs',        'jobs_read_pub')
  ) AS v(tbl, pol)
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = p.tbl AND policyname = p.pol
    ) THEN
      EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated', p.pol, p.tbl);
    END IF;
  END LOOP;
END $$;
