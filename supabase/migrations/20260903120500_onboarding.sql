-- Integração: trilha padrão, progresso do colaborador e materiais vistos
-- O percentual da trilha é sempre derivado — nunca armazenado.

ALTER TABLE public.onboarding_materials
  ADD COLUMN IF NOT EXISTS duration_label TEXT,
  ADD COLUMN IF NOT EXISTS material_type  TEXT,
  ADD COLUMN IF NOT EXISTS required       BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.onboarding_materials.duration_label IS '"6 min", "PDF · 8 páginas".';
COMMENT ON COLUMN public.onboarding_materials.material_type  IS 'video | pdf | politica | livro — casa com o ICON_MAP.';

-- ============ Trilha padrão ============
CREATE TABLE IF NOT EXISTS public.onboarding_checklist_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  detail         TEXT,
  stage          TEXT NOT NULL DEFAULT 'primeiro_dia'
                   CHECK (stage IN ('primeiro_dia', 'primeira_semana', 'trinta_dias', 'sessenta_dias', 'noventa_dias')),
  deadline_label TEXT,
  order_index    INT     NOT NULL DEFAULT 0,
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_onboarding_items_updated ON public.onboarding_checklist_items;
CREATE TRIGGER trg_onboarding_items_updated
  BEFORE UPDATE ON public.onboarding_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT                  ON public.onboarding_checklist_items TO authenticated;
GRANT INSERT, UPDATE, DELETE  ON public.onboarding_checklist_items TO authenticated;
GRANT ALL                     ON public.onboarding_checklist_items TO service_role;

ALTER TABLE public.onboarding_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY onboarding_items_read ON public.onboarding_checklist_items
  FOR SELECT TO authenticated
  USING (active = true OR app_private.is_admin(auth.uid()));

CREATE POLICY onboarding_items_admin_write ON public.onboarding_checklist_items
  FOR ALL TO authenticated
  USING (app_private.is_admin(auth.uid()))
  WITH CHECK (app_private.is_admin(auth.uid()));

-- ============ Progresso do colaborador ============
CREATE TABLE IF NOT EXISTS public.onboarding_progress (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  item_id     UUID NOT NULL REFERENCES public.onboarding_checklist_items(id) ON DELETE CASCADE,
  done_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, item_id)
);
CREATE INDEX IF NOT EXISTS onboarding_progress_employee_idx ON public.onboarding_progress (employee_id);

GRANT SELECT, INSERT, DELETE ON public.onboarding_progress TO authenticated;
GRANT ALL                    ON public.onboarding_progress TO service_role;

ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY onboarding_progress_self ON public.onboarding_progress
  FOR ALL TO authenticated
  USING (employee_id = app_private.current_employee_id())
  WITH CHECK (employee_id = app_private.current_employee_id());

-- O admin acompanha o progresso do time na visão de Integração.
CREATE POLICY onboarding_progress_admin_read ON public.onboarding_progress
  FOR SELECT TO authenticated
  USING (app_private.is_admin(auth.uid()));

-- ============ Materiais vistos ============
CREATE TABLE IF NOT EXISTS public.material_views (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.onboarding_materials(id) ON DELETE CASCADE,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, material_id)
);

GRANT SELECT, INSERT, DELETE ON public.material_views TO authenticated;
GRANT ALL                    ON public.material_views TO service_role;

ALTER TABLE public.material_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY material_views_self ON public.material_views
  FOR ALL TO authenticated
  USING (employee_id = app_private.current_employee_id())
  WITH CHECK (employee_id = app_private.current_employee_id());

CREATE POLICY material_views_admin_read ON public.material_views
  FOR SELECT TO authenticated
  USING (app_private.is_admin(auth.uid()));
