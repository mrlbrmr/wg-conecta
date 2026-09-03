-- Solicitações: um modelo, três telas (Gente & Gestão, Formulários e Meu perfil)

ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS sla_days INT NOT NULL DEFAULT 3;

COMMENT ON COLUMN public.forms.sla_days IS 'Prazo combinado em dias úteis — "Resposta em N dias úteis".';

CREATE SEQUENCE IF NOT EXISTS public.request_protocol_seq START WITH 1001;
GRANT USAGE, SELECT ON SEQUENCE public.request_protocol_seq TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol    INT  NOT NULL UNIQUE DEFAULT nextval('public.request_protocol_seq'),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  form_id     UUID REFERENCES public.forms(id) ON DELETE SET NULL,  -- nulo = solicitação livre
  title       TEXT NOT NULL CHECK (length(btrim(title)) > 0),
  subject     TEXT,
  body        TEXT,
  status      TEXT NOT NULL DEFAULT 'em_analise'
                CHECK (status IN ('em_analise', 'respondida', 'concluida')),
  assignee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  due_date    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS requests_employee_idx ON public.requests (employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS requests_status_idx   ON public.requests (status);

DROP TRIGGER IF EXISTS trg_requests_updated ON public.requests;
CREATE TRIGGER trg_requests_updated
  BEFORE UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT ON public.requests TO authenticated;
GRANT UPDATE, DELETE  ON public.requests TO authenticated;
GRANT ALL             ON public.requests TO service_role;

ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- Cada colaborador vê apenas as próprias solicitações.
CREATE POLICY requests_self_read ON public.requests
  FOR SELECT TO authenticated
  USING (employee_id = app_private.current_employee_id());

CREATE POLICY requests_self_insert ON public.requests
  FOR INSERT TO authenticated
  WITH CHECK (employee_id = app_private.current_employee_id() AND status = 'em_analise');

CREATE POLICY requests_admin_all ON public.requests
  FOR ALL TO authenticated
  USING (app_private.is_admin(auth.uid()))
  WITH CHECK (app_private.is_admin(auth.uid()));

-- ============ Conversa da solicitação ============
CREATE TABLE IF NOT EXISTS public.request_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  author_id  UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  body       TEXT NOT NULL CHECK (length(btrim(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS request_messages_request_idx ON public.request_messages (request_id, created_at);

GRANT SELECT, INSERT ON public.request_messages TO authenticated;
GRANT ALL            ON public.request_messages TO service_role;

ALTER TABLE public.request_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY request_messages_participant_read ON public.request_messages
  FOR SELECT TO authenticated
  USING (
    app_private.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = request_id AND r.employee_id = app_private.current_employee_id()
    )
  );

CREATE POLICY request_messages_participant_insert ON public.request_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = app_private.current_employee_id()
    AND EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = request_id AND r.employee_id = app_private.current_employee_id()
    )
  );

CREATE POLICY request_messages_admin_all ON public.request_messages
  FOR ALL TO authenticated
  USING (app_private.is_admin(auth.uid()))
  WITH CHECK (app_private.is_admin(auth.uid()));
