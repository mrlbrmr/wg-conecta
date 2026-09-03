-- Mural: leitura, reações e comentários + campos editoriais do comunicado

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS lead        TEXT,
  ADD COLUMN IF NOT EXISTS author_name TEXT,
  ADD COLUMN IF NOT EXISTS author_role TEXT,
  ADD COLUMN IF NOT EXISTS headline    BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.announcements.lead     IS 'Lide do detalhe: 20px/1.6, peso 600.';
COMMENT ON COLUMN public.announcements.headline IS 'Manchete do feed — o cartão preto grande.';

-- status era texto livre; fecha o domínio sem quebrar linhas existentes
UPDATE public.announcements
   SET status = 'rascunho'
 WHERE status NOT IN ('rascunho', 'publicado', 'arquivado');

ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS announcements_status_check;
ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_status_check
  CHECK (status IN ('rascunho', 'publicado', 'arquivado'));

-- ============ Leituras ============
CREATE TABLE IF NOT EXISTS public.announcement_reads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  read_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, employee_id)
);
CREATE INDEX IF NOT EXISTS announcement_reads_employee_idx ON public.announcement_reads (employee_id);

GRANT SELECT, INSERT, DELETE ON public.announcement_reads TO authenticated;
GRANT ALL                    ON public.announcement_reads TO service_role;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

-- Cada um enxerga a própria leitura; o admin vê tudo (taxa de leitura do painel).
CREATE POLICY announcement_reads_self ON public.announcement_reads
  FOR ALL TO authenticated
  USING (employee_id = app_private.current_employee_id())
  WITH CHECK (employee_id = app_private.current_employee_id());

CREATE POLICY announcement_reads_admin_read ON public.announcement_reads
  FOR SELECT TO authenticated
  USING (app_private.is_admin(auth.uid()));

-- ============ Reações ============
CREATE TABLE IF NOT EXISTS public.announcement_reactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  reaction        TEXT NOT NULL CHECK (reaction IN ('curti', 'importante', 'obrigado', 'parabens')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- uma reação por pessoa e por comunicado: trocar move o voto, repetir remove
  UNIQUE (announcement_id, employee_id)
);
CREATE INDEX IF NOT EXISTS announcement_reactions_ann_idx ON public.announcement_reactions (announcement_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcement_reactions TO authenticated;
GRANT ALL                            ON public.announcement_reactions TO service_role;
ALTER TABLE public.announcement_reactions ENABLE ROW LEVEL SECURITY;

-- Contagem é pública ao portal; escrever, só em nome próprio.
CREATE POLICY announcement_reactions_read ON public.announcement_reactions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY announcement_reactions_self_write ON public.announcement_reactions
  FOR ALL TO authenticated
  USING (employee_id = app_private.current_employee_id())
  WITH CHECK (employee_id = app_private.current_employee_id());

-- ============ Comentários ============
CREATE TABLE IF NOT EXISTS public.announcement_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  author_id       UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  body            TEXT NOT NULL CHECK (length(btrim(body)) > 0),
  official        BOOLEAN NOT NULL DEFAULT false,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS announcement_comments_ann_idx ON public.announcement_comments (announcement_id, created_at);

DROP TRIGGER IF EXISTS trg_announcement_comments_updated ON public.announcement_comments;
CREATE TRIGGER trg_announcement_comments_updated
  BEFORE UPDATE ON public.announcement_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcement_comments TO authenticated;
GRANT ALL                            ON public.announcement_comments TO service_role;
ALTER TABLE public.announcement_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY announcement_comments_read ON public.announcement_comments
  FOR SELECT TO authenticated
  USING (active = true OR app_private.is_admin(auth.uid()));

-- Qualquer colaborador comenta; `official` fica para o admin marcar.
CREATE POLICY announcement_comments_insert_self ON public.announcement_comments
  FOR INSERT TO authenticated
  WITH CHECK (author_id = app_private.current_employee_id() AND official = false);

CREATE POLICY announcement_comments_update_self ON public.announcement_comments
  FOR UPDATE TO authenticated
  USING (author_id = app_private.current_employee_id())
  WITH CHECK (author_id = app_private.current_employee_id() AND official = false);

CREATE POLICY announcement_comments_admin_write ON public.announcement_comments
  FOR ALL TO authenticated
  USING (app_private.is_admin(auth.uid()))
  WITH CHECK (app_private.is_admin(auth.uid()));
