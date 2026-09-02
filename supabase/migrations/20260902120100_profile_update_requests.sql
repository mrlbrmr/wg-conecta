-- Solicitações de atualização cadastral abertas pelo colaborador no portal.
-- O time de Gente & Gestão revisa e, ao aprovar, os valores são aplicados em employees.

-- Allowlist de campos solicitáveis, no próprio banco.
-- Defesa em profundidade: a validação zod da server function pode ser contornada
-- por uma chamada direta ao PostgREST (a RLS permite INSERT ao próprio colaborador).
CREATE OR REPLACE FUNCTION app_private.profile_request_keys_ok(p jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM jsonb_object_keys(p) k
    WHERE k NOT IN (
      'name', 'email', 'phone', 'birth_date', 'marital_status', 'education_level',
      'dependents', 'address_zip', 'address_street', 'address_number',
      'address_complement', 'address_district', 'address_city', 'address_state'
    )
  );
$$;
REVOKE ALL ON FUNCTION app_private.profile_request_keys_ok(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.profile_request_keys_ok(jsonb) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.profile_update_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  auth_user_id  UUID NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pendente'
                CHECK (status IN ('pendente', 'aprovada', 'rejeitada', 'cancelada')),
  -- { campo: { from, to } } — snapshot histórico do que foi pedido
  changes       JSONB NOT NULL DEFAULT '{}'::jsonb,
  note          TEXT,
  reviewer_id   UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  -- desnormalizado: o histórico não perde o autor se o admin for removido
  reviewer_name TEXT,
  reviewer_note TEXT,
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pur_changes_is_object CHECK (jsonb_typeof(changes) = 'object'),
  CONSTRAINT pur_changes_keys      CHECK (app_private.profile_request_keys_ok(changes))
);

CREATE INDEX IF NOT EXISTS pur_status_created_idx
  ON public.profile_update_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS pur_employee_idx
  ON public.profile_update_requests (employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pur_auth_user_idx
  ON public.profile_update_requests (auth_user_id);

-- No máximo uma solicitação pendente por colaborador
CREATE UNIQUE INDEX IF NOT EXISTS pur_one_pending_idx
  ON public.profile_update_requests (employee_id) WHERE status = 'pendente';

DROP TRIGGER IF EXISTS trg_pur_updated ON public.profile_update_requests;
CREATE TRIGGER trg_pur_updated BEFORE UPDATE ON public.profile_update_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- UPDATE limitado à coluna status: impede que o colaborador altere os valores
-- de `changes` depois de enviada a solicitação (a RLS não filtra por coluna).
-- Admins escrevem pelo service role, que ignora GRANTs.
GRANT SELECT, INSERT ON public.profile_update_requests TO authenticated;
GRANT UPDATE (status) ON public.profile_update_requests TO authenticated;
GRANT ALL ON public.profile_update_requests TO service_role;

ALTER TABLE public.profile_update_requests ENABLE ROW LEVEL SECURITY;

-- Admin gerencia todas
DROP POLICY IF EXISTS pur_admin_all ON public.profile_update_requests;
CREATE POLICY pur_admin_all ON public.profile_update_requests
  FOR ALL TO authenticated
  USING (app_private.is_admin(auth.uid()))
  WITH CHECK (app_private.is_admin(auth.uid()));

-- Colaborador lê as próprias
DROP POLICY IF EXISTS pur_self_read ON public.profile_update_requests;
CREATE POLICY pur_self_read ON public.profile_update_requests
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

-- Colaborador abre as próprias, sempre como pendente e sempre para o próprio cadastro
DROP POLICY IF EXISTS pur_self_insert ON public.profile_update_requests;
CREATE POLICY pur_self_insert ON public.profile_update_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_id = auth.uid()
    AND status = 'pendente'
    AND reviewer_id IS NULL AND reviewed_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = employee_id AND e.auth_user_id = auth.uid()
    )
  );

-- Colaborador só pode cancelar a própria solicitação pendente
DROP POLICY IF EXISTS pur_self_cancel ON public.profile_update_requests;
CREATE POLICY pur_self_cancel ON public.profile_update_requests
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid() AND status = 'pendente')
  WITH CHECK (auth_user_id = auth.uid() AND status IN ('pendente', 'cancelada'));
