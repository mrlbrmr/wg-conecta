-- Gente & Gestão e Vagas: prazos do mês, benefícios em destaque, campos da vaga

CREATE TABLE IF NOT EXISTS public.monthly_deadlines (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT NOT NULL,
  due_date    DATE NOT NULL,
  order_index INT     NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS monthly_deadlines_due_idx ON public.monthly_deadlines (due_date);

DROP TRIGGER IF EXISTS trg_monthly_deadlines_updated ON public.monthly_deadlines;
CREATE TRIGGER trg_monthly_deadlines_updated
  BEFORE UPDATE ON public.monthly_deadlines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT                 ON public.monthly_deadlines TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.monthly_deadlines TO authenticated;
GRANT ALL                    ON public.monthly_deadlines TO service_role;
ALTER TABLE public.monthly_deadlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY monthly_deadlines_read ON public.monthly_deadlines
  FOR SELECT TO authenticated
  USING (active = true OR app_private.is_admin(auth.uid()));
CREATE POLICY monthly_deadlines_admin_write ON public.monthly_deadlines
  FOR ALL TO authenticated
  USING (app_private.is_admin(auth.uid()))
  WITH CHECK (app_private.is_admin(auth.uid()));

-- ============ Benefícios em destaque ============
ALTER TABLE public.benefits
  ADD COLUMN IF NOT EXISTS featured  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS next_date DATE,
  ADD COLUMN IF NOT EXISTS badge     TEXT;

COMMENT ON COLUMN public.benefits.badge IS 'Rótulo do chip: "Novo", "Reajustado"… vazio usa o chip soft.';

-- ============ Vagas internas ============
ALTER TABLE public.internal_jobs
  ADD COLUMN IF NOT EXISTS unit                  TEXT,
  ADD COLUMN IF NOT EXISTS applications_deadline DATE,
  ADD COLUMN IF NOT EXISTS owner                 TEXT,
  ADD COLUMN IF NOT EXISTS applicants_count      INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.internal_jobs.unit IS 'Unidade para o filtro (Matriz SJP, Curitiba, Joinville). location = endereço.';

UPDATE public.internal_jobs
   SET status = 'aberta'
 WHERE status NOT IN ('aberta', 'pausada', 'encerrada');

ALTER TABLE public.internal_jobs DROP CONSTRAINT IF EXISTS internal_jobs_status_check;
ALTER TABLE public.internal_jobs
  ADD CONSTRAINT internal_jobs_status_check
  CHECK (status IN ('aberta', 'pausada', 'encerrada'));
