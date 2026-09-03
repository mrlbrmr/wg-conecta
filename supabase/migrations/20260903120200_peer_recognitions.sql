-- Reconhecimento entre colegas
--
-- Distinta de `recognitions`, que é curada pelo admin e guarda o nome da pessoa
-- em texto livre. Aqui as duas pontas são colaboradores de verdade: a tela de
-- Cultura mostra as duas fontes, o perfil mostra só as recebidas pelo usuário.

CREATE TABLE IF NOT EXISTS public.peer_recognitions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_employee_id   UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  from_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  message          TEXT NOT NULL CHECK (length(btrim(message)) > 0),
  highlight        BOOLEAN NOT NULL DEFAULT false,
  status           TEXT NOT NULL DEFAULT 'publicado'
                     CHECK (status IN ('publicado', 'em_revisao', 'arquivado')),
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT peer_recognitions_not_self CHECK (to_employee_id IS DISTINCT FROM from_employee_id)
);

CREATE INDEX IF NOT EXISTS peer_recognitions_to_idx      ON public.peer_recognitions (to_employee_id);
CREATE INDEX IF NOT EXISTS peer_recognitions_created_idx ON public.peer_recognitions (created_at DESC);

DROP TRIGGER IF EXISTS trg_peer_recognitions_updated ON public.peer_recognitions;
CREATE TRIGGER trg_peer_recognitions_updated
  BEFORE UPDATE ON public.peer_recognitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT ON public.peer_recognitions TO authenticated;
GRANT UPDATE, DELETE  ON public.peer_recognitions TO authenticated;
GRANT ALL             ON public.peer_recognitions TO service_role;

ALTER TABLE public.peer_recognitions ENABLE ROW LEVEL SECURITY;

-- Leitura pública ao portal: reconhecimento é para ser visto.
CREATE POLICY peer_recognitions_read ON public.peer_recognitions
  FOR SELECT TO authenticated
  USING ((active = true AND status = 'publicado') OR app_private.is_admin(auth.uid()));

-- O colaborador só publica em nome próprio, e não para si mesmo.
CREATE POLICY peer_recognitions_insert_self ON public.peer_recognitions
  FOR INSERT TO authenticated
  WITH CHECK (from_employee_id = app_private.current_employee_id());

CREATE POLICY peer_recognitions_admin_write ON public.peer_recognitions
  FOR ALL TO authenticated
  USING (app_private.is_admin(auth.uid()))
  WITH CHECK (app_private.is_admin(auth.uid()));
