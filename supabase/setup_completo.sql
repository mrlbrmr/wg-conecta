-- =============================================================
-- WG Conecta — Setup completo do banco de dados
-- Execute este arquivo UMA VEZ no SQL Editor do Supabase.
-- Idempotente: usa IF NOT EXISTS / CREATE OR REPLACE / DROP IF EXISTS.
-- =============================================================


-- ===================== FUNÇÕES UTILITÁRIAS =====================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;


-- ===================== TABELA: admin_users (sem RLS ainda) =====================
-- Criada ANTES de app_private.is_admin porque a função SQL valida
-- a existência da tabela no momento da criação.

CREATE TABLE IF NOT EXISTS public.admin_users (
  id         UUID PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_users TO authenticated;
GRANT ALL ON public.admin_users TO service_role;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_admin_users_updated ON public.admin_users;
CREATE TRIGGER trg_admin_users_updated
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_admin_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.admin_users (id, name, email, active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.handle_new_admin_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_admin_user();


-- ===================== SCHEMA PRIVADO + is_admin =====================
-- Agora admin_users já existe, então a função SQL pode ser criada.

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA app_private TO postgres, service_role;

CREATE OR REPLACE FUNCTION app_private.is_admin(uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE id = uid AND active = true);
$$;
REVOKE ALL ON FUNCTION app_private.is_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.is_admin(uuid) TO authenticated, service_role;


-- ===================== RLS: admin_users =====================
-- Adicionadas após is_admin existir.

DROP POLICY IF EXISTS admin_users_admin_all ON public.admin_users;
CREATE POLICY admin_users_admin_all ON public.admin_users FOR ALL TO authenticated
  USING (app_private.is_admin(auth.uid()))
  WITH CHECK (app_private.is_admin(auth.uid()));

DROP POLICY IF EXISTS admin_users_self_read ON public.admin_users;
CREATE POLICY admin_users_self_read ON public.admin_users FOR SELECT TO authenticated
  USING (id = auth.uid());


-- ===================== TABELA: portal_settings =====================

CREATE TABLE IF NOT EXISTS public.portal_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_name     TEXT NOT NULL DEFAULT 'Portal do Colaborador WG',
  welcome_text    TEXT NOT NULL DEFAULT 'Bem-vindo(a) ao Portal do Colaborador WG',
  logo_url        TEXT,
  primary_color   TEXT NOT NULL DEFAULT '#2F8F4A',
  privacy_notice  TEXT NOT NULL DEFAULT 'Este portal reúne informações internas do Grupo WG. Os conteúdos aqui publicados são de uso interno.',
  gg_contact_text TEXT NOT NULL DEFAULT 'Fale com Gente & Gestão: gestaodepessoas@wgbaterias.com.br',
  footer_message  TEXT NOT NULL DEFAULT '© Grupo WG / WG Baterias — Portal do Colaborador',
  singleton       BOOLEAN NOT NULL DEFAULT true UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.portal_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.portal_settings TO authenticated;
GRANT ALL ON public.portal_settings TO service_role;
ALTER TABLE public.portal_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portal_settings_read_all ON public.portal_settings;
CREATE POLICY portal_settings_read_all ON public.portal_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS portal_settings_write_auth ON public.portal_settings;
CREATE POLICY portal_settings_write_auth ON public.portal_settings FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_portal_settings_updated ON public.portal_settings;
CREATE TRIGGER trg_portal_settings_updated
  BEFORE UPDATE ON public.portal_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.portal_settings (singleton) VALUES (true) ON CONFLICT DO NOTHING;


-- ===================== TABELA: quick_links =====================

CREATE TABLE IF NOT EXISTS public.quick_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  icon        TEXT,
  url         TEXT NOT NULL,
  category    TEXT,
  order_index INT NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.quick_links TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.quick_links TO authenticated;
GRANT ALL ON public.quick_links TO service_role;
ALTER TABLE public.quick_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quick_links_read_active ON public.quick_links;
CREATE POLICY quick_links_read_active ON public.quick_links
  FOR SELECT USING (active OR app_private.is_admin(auth.uid()));
DROP POLICY IF EXISTS quick_links_write_auth ON public.quick_links;
CREATE POLICY quick_links_write_auth ON public.quick_links
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_quick_links_updated ON public.quick_links;
CREATE TRIGGER trg_quick_links_updated
  BEFORE UPDATE ON public.quick_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ===================== TABELA: announcements =====================

CREATE TABLE IF NOT EXISTS public.announcements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  summary        TEXT,
  content        TEXT,
  image_url      TEXT,
  attachment_url TEXT,
  category       TEXT,
  tags           TEXT[] DEFAULT '{}',
  published_at   TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ,
  status         TEXT NOT NULL DEFAULT 'rascunho',
  pinned         BOOLEAN NOT NULL DEFAULT false,
  important      BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS announcements_read_pub ON public.announcements;
CREATE POLICY announcements_read_pub ON public.announcements
  FOR SELECT USING (status = 'publicado' OR app_private.is_admin(auth.uid()));
DROP POLICY IF EXISTS announcements_write_auth ON public.announcements;
CREATE POLICY announcements_write_auth ON public.announcements
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_announcements_updated ON public.announcements;
CREATE TRIGGER trg_announcements_updated
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ===================== TABELA: benefits =====================

CREATE TABLE IF NOT EXISTS public.benefits (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  description    TEXT,
  eligibility    TEXT,
  observation    TEXT,
  external_url   TEXT,
  attachment_url TEXT,
  icon           TEXT,
  image_url      TEXT,
  order_index    INT NOT NULL DEFAULT 0,
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.benefits TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.benefits TO authenticated;
GRANT ALL ON public.benefits TO service_role;
ALTER TABLE public.benefits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS benefits_read_active ON public.benefits;
CREATE POLICY benefits_read_active ON public.benefits
  FOR SELECT USING (active OR app_private.is_admin(auth.uid()));
DROP POLICY IF EXISTS benefits_write_auth ON public.benefits;
CREATE POLICY benefits_write_auth ON public.benefits
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_benefits_updated ON public.benefits;
CREATE TRIGGER trg_benefits_updated
  BEFORE UPDATE ON public.benefits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ===================== TABELA: documents =====================

CREATE TABLE IF NOT EXISTS public.documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  description  TEXT,
  category     TEXT,
  file_url     TEXT NOT NULL,
  tags         TEXT[] DEFAULT '{}',
  featured     BOOLEAN NOT NULL DEFAULT false,
  active       BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMPTZ DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.documents TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS documents_read_active ON public.documents;
CREATE POLICY documents_read_active ON public.documents
  FOR SELECT USING (active OR app_private.is_admin(auth.uid()));
DROP POLICY IF EXISTS documents_write_auth ON public.documents;
CREATE POLICY documents_write_auth ON public.documents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_documents_updated ON public.documents;
CREATE TRIGGER trg_documents_updated
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ===================== TABELA: faq_items =====================

CREATE TABLE IF NOT EXISTS public.faq_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  category    TEXT,
  tags        TEXT[] DEFAULT '{}',
  order_index INT NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.faq_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.faq_items TO authenticated;
GRANT ALL ON public.faq_items TO service_role;
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS faq_read_active ON public.faq_items;
CREATE POLICY faq_read_active ON public.faq_items
  FOR SELECT USING (active OR app_private.is_admin(auth.uid()));
DROP POLICY IF EXISTS faq_write_auth ON public.faq_items;
CREATE POLICY faq_write_auth ON public.faq_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_faq_items_updated ON public.faq_items;
CREATE TRIGGER trg_faq_items_updated
  BEFORE UPDATE ON public.faq_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ===================== TABELA: internal_jobs =====================

CREATE TABLE IF NOT EXISTS public.internal_jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  location     TEXT,
  job_type     TEXT,
  summary      TEXT,
  requirements TEXT,
  external_url TEXT,
  status       TEXT NOT NULL DEFAULT 'aberta',
  published_at TIMESTAMPTZ DEFAULT now(),
  order_index  INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.internal_jobs TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.internal_jobs TO authenticated;
GRANT ALL ON public.internal_jobs TO service_role;
ALTER TABLE public.internal_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS jobs_read_pub ON public.internal_jobs;
CREATE POLICY jobs_read_pub ON public.internal_jobs
  FOR SELECT USING (status <> 'encerrada' OR app_private.is_admin(auth.uid()));
DROP POLICY IF EXISTS jobs_write_auth ON public.internal_jobs;
CREATE POLICY jobs_write_auth ON public.internal_jobs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_internal_jobs_updated ON public.internal_jobs;
CREATE TRIGGER trg_internal_jobs_updated
  BEFORE UPDATE ON public.internal_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ===================== TABELA: onboarding_materials =====================

CREATE TABLE IF NOT EXISTS public.onboarding_materials (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  description    TEXT,
  content        TEXT,
  image_url      TEXT,
  attachment_url TEXT,
  external_url   TEXT,
  category       TEXT,
  order_index    INT NOT NULL DEFAULT 0,
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.onboarding_materials TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.onboarding_materials TO authenticated;
GRANT ALL ON public.onboarding_materials TO service_role;
ALTER TABLE public.onboarding_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS onboarding_read_active ON public.onboarding_materials;
CREATE POLICY onboarding_read_active ON public.onboarding_materials
  FOR SELECT USING (active OR app_private.is_admin(auth.uid()));
DROP POLICY IF EXISTS onboarding_write_auth ON public.onboarding_materials;
CREATE POLICY onboarding_write_auth ON public.onboarding_materials
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_onboarding_updated ON public.onboarding_materials;
CREATE TRIGGER trg_onboarding_updated
  BEFORE UPDATE ON public.onboarding_materials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ===================== TABELA: forms =====================

CREATE TABLE IF NOT EXISTS public.forms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  description  TEXT,
  category     TEXT,
  external_url TEXT NOT NULL,
  icon         TEXT,
  order_index  INT NOT NULL DEFAULT 0,
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.forms TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.forms TO authenticated;
GRANT ALL ON public.forms TO service_role;
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS forms_read_active ON public.forms;
CREATE POLICY forms_read_active ON public.forms
  FOR SELECT USING (active OR app_private.is_admin(auth.uid()));
DROP POLICY IF EXISTS forms_write_auth ON public.forms;
CREATE POLICY forms_write_auth ON public.forms
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_forms_updated ON public.forms;
CREATE TRIGGER trg_forms_updated
  BEFORE UPDATE ON public.forms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ===================== TABELA: birthdays =====================

CREATE TABLE IF NOT EXISTS public.birthdays (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  role           TEXT,
  unit           TEXT,
  birthday_day   INT NOT NULL CHECK (birthday_day BETWEEN 1 AND 31),
  birthday_month INT NOT NULL CHECK (birthday_month BETWEEN 1 AND 12),
  photo_url      TEXT,
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, birthday_day, birthday_month)
);
GRANT SELECT ON public.birthdays TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.birthdays TO authenticated;
GRANT ALL ON public.birthdays TO service_role;
ALTER TABLE public.birthdays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS birthdays_read_active ON public.birthdays;
CREATE POLICY birthdays_read_active ON public.birthdays
  FOR SELECT USING (active OR app_private.is_admin(auth.uid()));
DROP POLICY IF EXISTS birthdays_write_auth ON public.birthdays;
CREATE POLICY birthdays_write_auth ON public.birthdays
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_birthdays_updated ON public.birthdays;
CREATE TRIGGER trg_birthdays_updated
  BEFORE UPDATE ON public.birthdays
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ===================== TABELA: work_anniversaries =====================

CREATE TABLE IF NOT EXISTS public.work_anniversaries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  role           TEXT,
  unit           TEXT,
  admission_date DATE NOT NULL,
  photo_url      TEXT,
  message        TEXT,
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, admission_date)
);
GRANT SELECT ON public.work_anniversaries TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.work_anniversaries TO authenticated;
GRANT ALL ON public.work_anniversaries TO service_role;
ALTER TABLE public.work_anniversaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wa_read_active ON public.work_anniversaries;
CREATE POLICY wa_read_active ON public.work_anniversaries
  FOR SELECT USING (active OR app_private.is_admin(auth.uid()));
DROP POLICY IF EXISTS wa_write_auth ON public.work_anniversaries;
CREATE POLICY wa_write_auth ON public.work_anniversaries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_wa_updated ON public.work_anniversaries;
CREATE TRIGGER trg_wa_updated
  BEFORE UPDATE ON public.work_anniversaries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ===================== TABELA: recognitions =====================

CREATE TABLE IF NOT EXISTS public.recognitions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  person_or_team   TEXT NOT NULL,
  description      TEXT,
  image_url        TEXT,
  recognition_date DATE NOT NULL DEFAULT CURRENT_DATE,
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.recognitions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.recognitions TO authenticated;
GRANT ALL ON public.recognitions TO service_role;
ALTER TABLE public.recognitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rec_read_active ON public.recognitions;
CREATE POLICY rec_read_active ON public.recognitions
  FOR SELECT USING (active OR app_private.is_admin(auth.uid()));
DROP POLICY IF EXISTS rec_write_auth ON public.recognitions;
CREATE POLICY rec_write_auth ON public.recognitions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_recognitions_updated ON public.recognitions;
CREATE TRIGGER trg_recognitions_updated
  BEFORE UPDATE ON public.recognitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ===================== TABELA: campaigns =====================

CREATE TABLE IF NOT EXISTS public.campaigns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  description  TEXT,
  image_url    TEXT,
  start_date   DATE,
  end_date     DATE,
  external_url TEXT,
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.campaigns TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS camp_read_active ON public.campaigns;
CREATE POLICY camp_read_active ON public.campaigns
  FOR SELECT USING (active OR app_private.is_admin(auth.uid()));
DROP POLICY IF EXISTS camp_write_auth ON public.campaigns;
CREATE POLICY camp_write_auth ON public.campaigns
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_campaigns_updated ON public.campaigns;
CREATE TRIGGER trg_campaigns_updated
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ===================== TABELA: contacts =====================

CREATE TABLE IF NOT EXISTS public.contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  area        TEXT,
  description TEXT,
  email       TEXT,
  phone       TEXT,
  photo_url   TEXT,
  order_index INT NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.contacts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contacts_read_active ON public.contacts;
CREATE POLICY contacts_read_active ON public.contacts
  FOR SELECT USING (active OR app_private.is_admin(auth.uid()));
DROP POLICY IF EXISTS contacts_write_auth ON public.contacts;
CREATE POLICY contacts_write_auth ON public.contacts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_contacts_updated ON public.contacts;
CREATE TRIGGER trg_contacts_updated
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ===================== TABELA: gg_pages =====================

CREATE TABLE IF NOT EXISTS public.gg_pages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key       TEXT NOT NULL UNIQUE,
  title          TEXT NOT NULL,
  body           TEXT,
  attachment_url TEXT,
  external_url   TEXT,
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gg_pages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.gg_pages TO authenticated;
GRANT ALL ON public.gg_pages TO service_role;
ALTER TABLE public.gg_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gg_pages_read_active ON public.gg_pages;
CREATE POLICY gg_pages_read_active ON public.gg_pages
  FOR SELECT USING (active OR app_private.is_admin(auth.uid()));
DROP POLICY IF EXISTS gg_pages_write_auth ON public.gg_pages;
CREATE POLICY gg_pages_write_auth ON public.gg_pages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_gg_pages_updated ON public.gg_pages;
CREATE TRIGGER trg_gg_pages_updated
  BEFORE UPDATE ON public.gg_pages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ===================== TABELA: employees =====================

CREATE TABLE IF NOT EXISTS public.employees (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  department TEXT,
  job_title  TEXT,
  active     BOOLEAN NOT NULL DEFAULT true,
  invited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employees_admin_all ON public.employees;
CREATE POLICY employees_admin_all ON public.employees FOR ALL TO authenticated
  USING (app_private.is_admin(auth.uid()))
  WITH CHECK (app_private.is_admin(auth.uid()));

DROP POLICY IF EXISTS employees_self_read ON public.employees;
CREATE POLICY employees_self_read ON public.employees FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS employees_self_update ON public.employees;
CREATE POLICY employees_self_update ON public.employees FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP TRIGGER IF EXISTS set_employees_updated_at ON public.employees;
CREATE TRIGGER set_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION app_private.is_employee(uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.employees WHERE id = uid AND active = true);
$$;
GRANT EXECUTE ON FUNCTION app_private.is_employee(uuid) TO authenticated, service_role;


-- ===================== STORAGE: bucket portal-public =====================

INSERT INTO storage.buckets (id, name, public)
VALUES ('portal-public', 'portal-public', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS portal_public_read ON storage.objects;
CREATE POLICY portal_public_read ON storage.objects
  FOR SELECT USING (bucket_id = 'portal-public');

DROP POLICY IF EXISTS portal_public_insert_admin ON storage.objects;
CREATE POLICY portal_public_insert_admin ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'portal-public' AND app_private.is_admin(auth.uid()));

DROP POLICY IF EXISTS portal_public_update_admin ON storage.objects;
CREATE POLICY portal_public_update_admin ON storage.objects
  FOR UPDATE TO authenticated
  USING  (bucket_id = 'portal-public' AND app_private.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'portal-public' AND app_private.is_admin(auth.uid()));

DROP POLICY IF EXISTS portal_public_delete_admin ON storage.objects;
CREATE POLICY portal_public_delete_admin ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'portal-public' AND app_private.is_admin(auth.uid()));


-- ===================== SEED DATA =====================

INSERT INTO public.gg_pages (page_key, title, body) VALUES
('ferias',    'Solicitação de Férias',  E'Para solicitar suas férias, siga o processo abaixo:\n\n1. Converse com sua liderança direta sobre o período desejado.\n2. Preencha o formulário de solicitação de férias.\n3. Envie para o Gente & Gestão com pelo menos 30 dias de antecedência.\n\nEm caso de dúvidas, fale com Gente & Gestão.'),
('atestados', 'Atestados Médicos',      E'Os atestados médicos devem ser lançados diretamente no sistema de ponto eletrônico.\n\nPrazo: em até 48h após a emissão.\n\nEm caso de dúvidas ou dificuldades com o sistema, entre em contato com Gente & Gestão.'),
('cadastro',  'Meu Perfil',             E'Atualize seu nome e e-mail diretamente nesta página. Para alterações de dados bancários, dependentes ou estado civil, entre em contato com Gente & Gestão.'),
('holerite',  'Holerite',               E'Acesse seu holerite pelo link do sistema oficial. Em caso de dúvidas, fale com Gente & Gestão.'),
('politicas', 'Políticas Internas',     E'Nesta área você encontra as políticas internas da empresa. Consulte a seção de Documentos para os arquivos oficiais.')
ON CONFLICT (page_key) DO NOTHING;

INSERT INTO public.benefits (title, description, eligibility, external_url, icon, order_index) VALUES
('Wellhub (Gympass)', 'Acesso a milhares de academias, estúdios e apps de bem-estar.', 'Disponível para colaboradores com mais de 90 dias de casa.', 'https://wellhub.com', 'Dumbbell', 1),
('Starbem', 'Consultas de saúde online com médicos e psicólogos.', 'Disponível para colaboradores com mais de 90 dias de casa.', 'https://starbem.app', 'HeartPulse', 2),
('Ponto Eletrônico', 'Sistema de registro de ponto.', 'Todos os colaboradores.', '', 'Clock', 3),
('Holerite Online', 'Acesse seu holerite mensal pelo portal oficial.', 'Todos os colaboradores.', '', 'FileText', 4)
ON CONFLICT DO NOTHING;

INSERT INTO public.quick_links (title, description, icon, url, order_index) VALUES
('Benefícios',        'Wellhub, Starbem e mais',       'Gift',          '/gente-gestao/beneficios', 1),
('Documentos',        'Políticas, formulários e mais',  'FolderOpen',    '/gente-gestao/documentos', 2),
('Dúvidas Frequentes','Respostas rápidas',              'HelpCircle',    '/gente-gestao/faq',        3),
('Vagas Internas',    'Oportunidades no Grupo WG',      'Briefcase',     '/vagas',                   4),
('Formulários',       'Links úteis do dia a dia',       'ClipboardList', '/formularios',             5),
('Integração',        'Boas-vindas e materiais',        'Sparkles',      '/integracao',              6),
('Cultura',           'Aniversariantes e campanhas',    'PartyPopper',   '/cultura',                 7),
('Fale com G&G',      'Contatos de Gente & Gestão',     'Users',         '/gente-gestao/contatos',   8)
ON CONFLICT DO NOTHING;

INSERT INTO public.announcements (title, summary, content, category, status, published_at, important, pinned) VALUES
('Bem-vindo(a) ao novo Portal do Colaborador WG',
 'Um só lugar para encontrar o que você precisa no dia a dia.',
 E'Estamos muito felizes em apresentar o novo Portal do Colaborador! Aqui você encontra benefícios, comunicados, documentos, formulários e muito mais em um só lugar.\n\nQualquer dúvida, fale com Gente & Gestão.',
 'Geral', 'publicado', now(), true, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.faq_items (question, answer, category, order_index) VALUES
('Como solicito minhas férias?',  'Converse com sua liderança e preencha o formulário disponível na área de Gente & Gestão. Prazo mínimo: 30 dias de antecedência.', 'Férias',    1),
('Onde envio meu atestado médico?','Atestados devem ser lançados no sistema de ponto eletrônico em até 48h após a emissão.',                                         'Atestados', 2),
('Como acesso o Wellhub?',         'Após 90 dias de casa, você recebe o link de cadastro por e-mail. Em caso de dúvidas, fale com Gente & Gestão.',                  'Benefícios',3),
('Como acesso meu holerite?',      'O holerite fica disponível no sistema oficial. Consulte o card de Holerite em Gente & Gestão.',                                   'Holerite',  4)
ON CONFLICT DO NOTHING;

INSERT INTO public.forms (title, description, category, external_url, icon, order_index) VALUES
('Formulário de Férias',    'Solicite suas férias',          'Férias',           'https://forms.gle/exemplo-ferias',   'CalendarDays',   1),
('Atualização Cadastral',   'Atualize seus dados',           'Atualização cadastral','https://forms.gle/exemplo-cadastro','UserCog',       2),
('Solicitação Geral G&G',   'Envie sua solicitação',         'Gente & Gestão',   'https://forms.gle/exemplo-gg',       'MessageSquare',  3)
ON CONFLICT DO NOTHING;

INSERT INTO public.internal_jobs (title, location, job_type, summary, requirements, external_url, status) VALUES
('Analista Comercial', 'Sede — Presencial', 'Efetivo',
 'Oportunidade para atuar na área comercial do Grupo WG.',
 'Ensino superior em andamento; experiência com vendas B2B; boa comunicação.',
 'https://carreiras.wgbaterias.com.br/', 'aberta')
ON CONFLICT DO NOTHING;

INSERT INTO public.campaigns (title, description, active, start_date, end_date) VALUES
('Campanha de Segurança no Trabalho',
 'Todo cuidado é pouco. Use os EPIs e siga os procedimentos de segurança.',
 true, CURRENT_DATE, CURRENT_DATE + INTERVAL '60 days')
ON CONFLICT DO NOTHING;

INSERT INTO public.contacts (name, area, description, email, order_index) VALUES
('Gente & Gestão', 'Recursos Humanos',
 'Fale conosco para dúvidas sobre benefícios, férias, atestados e cadastro.',
 'gestaodepessoas@wgbaterias.com.br', 1)
ON CONFLICT DO NOTHING;

INSERT INTO public.onboarding_materials (title, description, content, category, order_index) VALUES
('Boas-vindas ao Grupo WG', 'É uma alegria ter você conosco!',
 E'Seja muito bem-vindo(a) ao Grupo WG / WG Baterias!\n\nSomos uma empresa que valoriza pessoas, resultados e proximidade. Aqui você encontra informações essenciais para começar sua jornada.',
 'Boas-vindas', 1),
('Nossa História', 'Conheça o Grupo WG',
 E'O Grupo WG atua no segmento de distribuição de baterias, com equipes espalhadas por diferentes unidades e uma cultura próxima e humana.',
 'Empresa', 2)
ON CONFLICT DO NOTHING;
