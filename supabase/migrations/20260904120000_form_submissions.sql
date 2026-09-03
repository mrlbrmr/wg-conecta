-- Formulários internos: os três de Gente & Gestão saem do Google Forms e passam
-- a ser preenchidos dentro do portal.
--
-- Até aqui `forms` era só um catálogo de links: cada cartão levava para fora
-- (`external_url`). Agora um formulário pode ser interno — identificado por
-- `slug`, que é a rota (`/formularios/<slug>`) — e as respostas caem em
-- `requests`, junto das solicitações livres que já existiam.

-- ============ Catálogo: interno ou externo ============

ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- Índice único parcial em vez de UNIQUE na coluna: formulário externo não tem
-- slug, e vários NULL não podem disputar a mesma chave.
CREATE UNIQUE INDEX IF NOT EXISTS forms_slug_key
  ON public.forms (slug) WHERE slug IS NOT NULL;

COMMENT ON COLUMN public.forms.slug IS
  'Formulário interno: identifica a rota /formularios/<slug>. Nulo = link externo.';

ALTER TABLE public.forms ALTER COLUMN external_url DROP NOT NULL;

-- Um cartão precisa levar a algum lugar: ou para a rota interna, ou para fora.
ALTER TABLE public.forms DROP CONSTRAINT IF EXISTS forms_target_ck;
ALTER TABLE public.forms ADD CONSTRAINT forms_target_ck
  CHECK (slug IS NOT NULL OR external_url IS NOT NULL);

-- Os três registros semeados na migration inicial apontavam para
-- `https://forms.gle/exemplo-*` — placeholders que nunca existiram de verdade.
UPDATE public.forms
   SET slug = 'ferias', external_url = NULL, icon = 'ClipboardList', sla_days = 3
 WHERE title = 'Formulário de Férias' AND slug IS NULL;

UPDATE public.forms
   SET slug = 'atualizacao-cadastral', external_url = NULL, icon = 'UserCog', sla_days = 3
 WHERE title = 'Atualização Cadastral' AND slug IS NULL;

UPDATE public.forms
   SET slug = 'solicitacao-geral', external_url = NULL, icon = 'ClipboardCheck', sla_days = 3
 WHERE title = 'Solicitação Geral G&G' AND slug IS NULL;

-- ============ Respostas estruturadas ============

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS priority        TEXT,
  ADD COLUMN IF NOT EXISTS attachment_path TEXT;

COMMENT ON COLUMN public.requests.payload IS
  'Respostas do formulário. O formato de cada slug vive em src/lib/form-defs.ts (schema zod), que valida na escrita e formata na leitura.';
COMMENT ON COLUMN public.requests.attachment_path IS
  'Caminho no bucket privado `request-attachments`. Nunca servido pelo proxy público.';

ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_priority_ck;
ALTER TABLE public.requests ADD CONSTRAINT requests_priority_ck
  CHECK (priority IS NULL OR priority IN ('normal', 'prioritaria', 'urgente'));

CREATE INDEX IF NOT EXISTS requests_form_idx ON public.requests (form_id, created_at DESC);

-- ============ Matrícula ============
-- O formulário pede matrícula, o cadastro não tinha. Fica de leitura para o
-- colaborador: quem preenche é o DP, pelo painel. Repare que a coluna NÃO entra
-- no GRANT UPDATE por coluna de 20260903120100_employees_profile.sql — é dado do
-- DP, como cargo e admissão, e se corrige abrindo solicitação.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS registration_number TEXT;

COMMENT ON COLUMN public.employees.registration_number IS
  'Matrícula na folha. Somente-leitura para o colaborador; preenchida pelo painel.';

-- ============ Anexo: bucket privado ============
-- `portal-public` não serve: a policy de leitura dele é aberta a qualquer
-- autenticado e o proxy /api/public/files não pede login. Anexo de solicitação
-- carrega atestado e comprovante — merece bucket próprio, fechado.

INSERT INTO storage.buckets (id, name, public)
     VALUES ('request-attachments', 'request-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- O colaborador escreve só dentro da própria pasta (<employee_id>/…) — mesma
-- técnica da fresta de foto de perfil em 20260903120900.
DROP POLICY IF EXISTS request_attachments_own_insert ON storage.objects;
CREATE POLICY request_attachments_own_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'request-attachments'
    AND (storage.foldername(name))[1] = app_private.current_employee_id()::text
  );

-- Leitura: o dono do anexo e o time de G&G. Mais ninguém, nem `anon`.
DROP POLICY IF EXISTS request_attachments_read ON storage.objects;
CREATE POLICY request_attachments_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'request-attachments'
    AND (
      app_private.is_admin(auth.uid())
      OR (storage.foldername(name))[1] = app_private.current_employee_id()::text
    )
  );

DROP POLICY IF EXISTS request_attachments_admin_write ON storage.objects;
CREATE POLICY request_attachments_admin_write ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'request-attachments' AND app_private.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'request-attachments' AND app_private.is_admin(auth.uid()));
