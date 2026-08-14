
-- Utility trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ portal_settings (public config) ============
CREATE TABLE public.portal_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_name TEXT NOT NULL DEFAULT 'Portal do Colaborador WG',
  welcome_text TEXT NOT NULL DEFAULT 'Bem-vindo(a) ao Portal do Colaborador WG',
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#2F8F4A',
  privacy_notice TEXT NOT NULL DEFAULT 'Este portal reúne informações internas do Grupo WG. Os conteúdos aqui publicados são de uso interno.',
  gg_contact_text TEXT NOT NULL DEFAULT 'Fale com Gente & Gestão: gestaodepessoas@wgbaterias.com.br',
  footer_message TEXT NOT NULL DEFAULT '© Grupo WG / WG Baterias — Portal do Colaborador',
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.portal_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.portal_settings TO authenticated;
GRANT ALL ON public.portal_settings TO service_role;
ALTER TABLE public.portal_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "portal_settings_read_all" ON public.portal_settings FOR SELECT USING (true);
CREATE POLICY "portal_settings_write_auth" ON public.portal_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_portal_settings_updated BEFORE UPDATE ON public.portal_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.portal_settings (singleton) VALUES (true);

-- ============ portal_access (secret access code hash) ============
CREATE TABLE public.portal_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_code_hash TEXT,
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.portal_access TO authenticated;
GRANT ALL ON public.portal_access TO service_role;
ALTER TABLE public.portal_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "portal_access_auth_only" ON public.portal_access FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- Default access code: "WGBaterias2026" (SHA-256 hex) - admin will change
INSERT INTO public.portal_access (singleton, access_code_hash)
VALUES (true, encode(digest('WGBaterias2026', 'sha256'), 'hex'));

-- ============ admin_users (mirror of auth.users) ============
CREATE TABLE public.admin_users (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_users TO authenticated;
GRANT ALL ON public.admin_users TO service_role;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_users_auth_read" ON public.admin_users FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_users_auth_write" ON public.admin_users FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_admin_users_updated BEFORE UPDATE ON public.admin_users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger to auto-sync admin_users when new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_admin_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.admin_users (id, name, email, active)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.email, true)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created_admin AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_admin_user();

-- ============ Generic content tables ============
-- All follow same policy: anon read active rows; authenticated full CRUD

-- quick_links
CREATE TABLE public.quick_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  url TEXT NOT NULL,
  category TEXT,
  order_index INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.quick_links TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.quick_links TO authenticated;
GRANT ALL ON public.quick_links TO service_role;
ALTER TABLE public.quick_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quick_links_read_active" ON public.quick_links FOR SELECT USING (active OR auth.uid() IS NOT NULL);
CREATE POLICY "quick_links_write_auth" ON public.quick_links FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_quick_links_updated BEFORE UPDATE ON public.quick_links FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- announcements
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  image_url TEXT,
  attachment_url TEXT,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'rascunho', -- rascunho | publicado | arquivado
  pinned BOOLEAN NOT NULL DEFAULT false,
  important BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "announcements_read_pub" ON public.announcements FOR SELECT USING (status = 'publicado' OR auth.uid() IS NOT NULL);
CREATE POLICY "announcements_write_auth" ON public.announcements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_announcements_updated BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- benefits
CREATE TABLE public.benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  eligibility TEXT,
  observation TEXT,
  external_url TEXT,
  attachment_url TEXT,
  icon TEXT,
  image_url TEXT,
  order_index INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.benefits TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.benefits TO authenticated;
GRANT ALL ON public.benefits TO service_role;
ALTER TABLE public.benefits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "benefits_read_active" ON public.benefits FOR SELECT USING (active OR auth.uid() IS NOT NULL);
CREATE POLICY "benefits_write_auth" ON public.benefits FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_benefits_updated BEFORE UPDATE ON public.benefits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- documents
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  file_url TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  featured BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.documents TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents_read_active" ON public.documents FOR SELECT USING (active OR auth.uid() IS NOT NULL);
CREATE POLICY "documents_write_auth" ON public.documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_documents_updated BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- faq_items
CREATE TABLE public.faq_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  order_index INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.faq_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.faq_items TO authenticated;
GRANT ALL ON public.faq_items TO service_role;
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "faq_read_active" ON public.faq_items FOR SELECT USING (active OR auth.uid() IS NOT NULL);
CREATE POLICY "faq_write_auth" ON public.faq_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_faq_items_updated BEFORE UPDATE ON public.faq_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- internal_jobs
CREATE TABLE public.internal_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  location TEXT,
  job_type TEXT,
  summary TEXT,
  requirements TEXT,
  external_url TEXT,
  status TEXT NOT NULL DEFAULT 'aberta', -- aberta | pausada | encerrada
  published_at TIMESTAMPTZ DEFAULT now(),
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.internal_jobs TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.internal_jobs TO authenticated;
GRANT ALL ON public.internal_jobs TO service_role;
ALTER TABLE public.internal_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs_read_pub" ON public.internal_jobs FOR SELECT USING (status <> 'encerrada' OR auth.uid() IS NOT NULL);
CREATE POLICY "jobs_write_auth" ON public.internal_jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_internal_jobs_updated BEFORE UPDATE ON public.internal_jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- onboarding_materials
CREATE TABLE public.onboarding_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  image_url TEXT,
  attachment_url TEXT,
  external_url TEXT,
  category TEXT,
  order_index INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.onboarding_materials TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.onboarding_materials TO authenticated;
GRANT ALL ON public.onboarding_materials TO service_role;
ALTER TABLE public.onboarding_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "onboarding_read_active" ON public.onboarding_materials FOR SELECT USING (active OR auth.uid() IS NOT NULL);
CREATE POLICY "onboarding_write_auth" ON public.onboarding_materials FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_onboarding_updated BEFORE UPDATE ON public.onboarding_materials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- forms
CREATE TABLE public.forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  external_url TEXT NOT NULL,
  icon TEXT,
  order_index INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.forms TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.forms TO authenticated;
GRANT ALL ON public.forms TO service_role;
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "forms_read_active" ON public.forms FOR SELECT USING (active OR auth.uid() IS NOT NULL);
CREATE POLICY "forms_write_auth" ON public.forms FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_forms_updated BEFORE UPDATE ON public.forms FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- birthdays
CREATE TABLE public.birthdays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT,
  unit TEXT,
  birthday_day INT NOT NULL CHECK (birthday_day BETWEEN 1 AND 31),
  birthday_month INT NOT NULL CHECK (birthday_month BETWEEN 1 AND 12),
  photo_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, birthday_day, birthday_month)
);
GRANT SELECT ON public.birthdays TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.birthdays TO authenticated;
GRANT ALL ON public.birthdays TO service_role;
ALTER TABLE public.birthdays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "birthdays_read_active" ON public.birthdays FOR SELECT USING (active OR auth.uid() IS NOT NULL);
CREATE POLICY "birthdays_write_auth" ON public.birthdays FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_birthdays_updated BEFORE UPDATE ON public.birthdays FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- work_anniversaries
CREATE TABLE public.work_anniversaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT,
  unit TEXT,
  admission_date DATE NOT NULL,
  photo_url TEXT,
  message TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, admission_date)
);
GRANT SELECT ON public.work_anniversaries TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.work_anniversaries TO authenticated;
GRANT ALL ON public.work_anniversaries TO service_role;
ALTER TABLE public.work_anniversaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_read_active" ON public.work_anniversaries FOR SELECT USING (active OR auth.uid() IS NOT NULL);
CREATE POLICY "wa_write_auth" ON public.work_anniversaries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_wa_updated BEFORE UPDATE ON public.work_anniversaries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- recognitions
CREATE TABLE public.recognitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  person_or_team TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  recognition_date DATE NOT NULL DEFAULT CURRENT_DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.recognitions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.recognitions TO authenticated;
GRANT ALL ON public.recognitions TO service_role;
ALTER TABLE public.recognitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rec_read_active" ON public.recognitions FOR SELECT USING (active OR auth.uid() IS NOT NULL);
CREATE POLICY "rec_write_auth" ON public.recognitions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_recognitions_updated BEFORE UPDATE ON public.recognitions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- campaigns
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  start_date DATE,
  end_date DATE,
  external_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.campaigns TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "camp_read_active" ON public.campaigns FOR SELECT USING (active OR auth.uid() IS NOT NULL);
CREATE POLICY "camp_write_auth" ON public.campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- contacts
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  area TEXT,
  description TEXT,
  email TEXT,
  phone TEXT,
  photo_url TEXT,
  order_index INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.contacts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts_read_active" ON public.contacts FOR SELECT USING (active OR auth.uid() IS NOT NULL);
CREATE POLICY "contacts_write_auth" ON public.contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- gg_pages: editable pages for férias, atestados, cadastro, holerite, políticas
CREATE TABLE public.gg_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key TEXT NOT NULL UNIQUE,  -- 'ferias','atestados','cadastro','holerite','politicas'
  title TEXT NOT NULL,
  body TEXT,
  attachment_url TEXT,
  external_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gg_pages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.gg_pages TO authenticated;
GRANT ALL ON public.gg_pages TO service_role;
ALTER TABLE public.gg_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gg_pages_read_active" ON public.gg_pages FOR SELECT USING (active OR auth.uid() IS NOT NULL);
CREATE POLICY "gg_pages_write_auth" ON public.gg_pages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_gg_pages_updated BEFORE UPDATE ON public.gg_pages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ================= SEED DATA =================
INSERT INTO public.gg_pages (page_key, title, body) VALUES
('ferias', 'Solicitação de Férias', E'Para solicitar suas férias, siga o processo abaixo:\n\n1. Converse com sua liderança direta sobre o período desejado.\n2. Preencha o formulário de solicitação de férias.\n3. Envie para o Gente & Gestão com pelo menos 30 dias de antecedência.\n\nEm caso de dúvidas, fale com Gente & Gestão.'),
('atestados', 'Atestados Médicos', E'Os atestados médicos devem ser lançados diretamente no sistema de ponto eletrônico.\n\nPrazo: em até 48h após a emissão.\n\nEm caso de dúvidas ou dificuldades com o sistema, entre em contato com Gente & Gestão.'),
('cadastro', 'Atualização Cadastral', E'Manteve seu cadastro atualizado é importante para receber comunicados, benefícios e informações corretas.\n\nPara atualizar endereço, telefone, estado civil, dependentes ou dados bancários, entre em contato com Gente & Gestão ou utilize o formulário oficial.'),
('holerite', 'Holerite', E'Acesse seu holerite pelo link do sistema oficial. Em caso de dúvidas, fale com Gente & Gestão.'),
('politicas', 'Políticas Internas', E'Nesta área você encontra as políticas internas da empresa. Consulte a seção de Documentos para os arquivos oficiais.');

INSERT INTO public.benefits (title, description, eligibility, external_url, icon, order_index) VALUES
('Wellhub (Gympass)', 'Acesso a milhares de academias, estúdios e apps de bem-estar.', 'Disponível para colaboradores com mais de 90 dias de casa.', 'https://wellhub.com', 'Dumbbell', 1),
('Starbem', 'Consultas de saúde online com médicos e psicólogos.', 'Disponível para colaboradores com mais de 90 dias de casa.', 'https://starbem.app', 'HeartPulse', 2),
('Ponto Eletrônico', 'Sistema de registro de ponto. A empresa está em transição para um novo sistema — em breve novidades.', 'Todos os colaboradores.', '', 'Clock', 3),
('Holerite Online', 'Acesse seu holerite mensal pelo portal oficial.', 'Todos os colaboradores.', '', 'FileText', 4);

INSERT INTO public.quick_links (title, description, icon, url, order_index) VALUES
('Benefícios', 'Wellhub, Starbem e mais', 'Gift', '/gente-gestao/beneficios', 1),
('Documentos', 'Políticas, formulários e mais', 'FolderOpen', '/gente-gestao/documentos', 2),
('Dúvidas Frequentes', 'Respostas rápidas', 'HelpCircle', '/gente-gestao/faq', 3),
('Vagas Internas', 'Oportunidades no Grupo WG', 'Briefcase', '/vagas', 4),
('Formulários', 'Links úteis do dia a dia', 'ClipboardList', '/formularios', 5),
('Integração', 'Boas-vindas e materiais', 'Sparkles', '/integracao', 6),
('Cultura', 'Aniversariantes e campanhas', 'PartyPopper', '/cultura', 7),
('Fale com G&G', 'Contatos de Gente & Gestão', 'Users', '/gente-gestao/contatos', 8);

INSERT INTO public.announcements (title, summary, content, category, status, published_at, important, pinned) VALUES
('Bem-vindo(a) ao novo Portal do Colaborador WG', 'Um só lugar para encontrar o que você precisa no dia a dia.', E'Estamos muito felizes em apresentar o novo Portal do Colaborador! Aqui você encontra benefícios, comunicados, documentos, formulários e muito mais em um só lugar.\n\nQualquer dúvida, fale com Gente & Gestão.', 'Geral', 'publicado', now(), true, true);

INSERT INTO public.faq_items (question, answer, category, order_index) VALUES
('Como solicito minhas férias?', 'Converse com sua liderança e preencha o formulário disponível na área de Gente & Gestão. Prazo mínimo: 30 dias de antecedência.', 'Férias', 1),
('Onde envio meu atestado médico?', 'Atestados devem ser lançados no sistema de ponto eletrônico em até 48h após a emissão.', 'Atestados', 2),
('Como acesso o Wellhub?', 'Após 90 dias de casa, você recebe o link de cadastro por e-mail. Em caso de dúvidas, fale com Gente & Gestão.', 'Benefícios', 3),
('Como acesso meu holerite?', 'O holerite fica disponível no sistema oficial. Consulte o card de Holerite em Gente & Gestão.', 'Holerite', 4);

INSERT INTO public.forms (title, description, category, external_url, icon, order_index) VALUES
('Formulário de Férias', 'Solicite suas férias', 'Férias', 'https://forms.gle/exemplo-ferias', 'CalendarDays', 1),
('Atualização Cadastral', 'Atualize seus dados', 'Atualização cadastral', 'https://forms.gle/exemplo-cadastro', 'UserCog', 2),
('Solicitação Geral G&G', 'Envie sua solicitação para o setor', 'Gente & Gestão', 'https://forms.gle/exemplo-gg', 'MessageSquare', 3);

INSERT INTO public.internal_jobs (title, location, job_type, summary, requirements, external_url, status) VALUES
('Analista Comercial', 'Sede — Presencial', 'Efetivo', 'Oportunidade para atuar na área comercial do Grupo WG.', 'Ensino superior em andamento; experiência com vendas B2B; boa comunicação.', 'https://carreiras.wgbaterias.com.br/', 'aberta');

INSERT INTO public.campaigns (title, description, active, start_date, end_date) VALUES
('Campanha de Segurança no Trabalho', 'Todo cuidado é pouco. Use os EPIs e siga os procedimentos de segurança.', true, CURRENT_DATE, CURRENT_DATE + INTERVAL '60 days');

INSERT INTO public.contacts (name, area, description, email, order_index) VALUES
('Gente & Gestão', 'Recursos Humanos', 'Fale conosco para dúvidas sobre benefícios, férias, atestados e cadastro.', 'gestaodepessoas@wgbaterias.com.br', 1);

INSERT INTO public.onboarding_materials (title, description, content, category, order_index) VALUES
('Boas-vindas ao Grupo WG', 'É uma alegria ter você conosco!', E'Seja muito bem-vindo(a) ao Grupo WG / WG Baterias!\n\nSomos uma empresa que valoriza pessoas, resultados e proximidade. Aqui você encontra informações essenciais para começar sua jornada.', 'Boas-vindas', 1),
('Nossa História', 'Conheça o Grupo WG', E'O Grupo WG atua no segmento de distribuição de baterias, com equipes espalhadas por diferentes unidades e uma cultura próxima e humana.', 'Empresa', 2);
