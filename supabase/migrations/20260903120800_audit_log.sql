-- Log de auditoria — alimenta a "Atividade recente" do painel

CREATE TABLE IF NOT EXISTS public.audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  actor_label TEXT,
  action      TEXT NOT NULL,
  resource    TEXT NOT NULL,
  resource_id UUID,
  summary     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_created_idx ON public.audit_log (created_at DESC);

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL    ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Só admin lê; a escrita passa sempre por server function (service role).
CREATE POLICY audit_log_admin_read ON public.audit_log
  FOR SELECT TO authenticated
  USING (app_private.is_admin(auth.uid()));
