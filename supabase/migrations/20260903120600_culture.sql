-- Cultura: o mês em fotos, calendário interno e "dar parabéns"

CREATE TABLE IF NOT EXISTS public.culture_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url   TEXT NOT NULL,
  title       TEXT NOT NULL,
  event_date  DATE,
  unit        TEXT,
  order_index INT     NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS culture_photos_date_idx ON public.culture_photos (event_date DESC);

DROP TRIGGER IF EXISTS trg_culture_photos_updated ON public.culture_photos;
CREATE TRIGGER trg_culture_photos_updated
  BEFORE UPDATE ON public.culture_photos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT                 ON public.culture_photos TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.culture_photos TO authenticated;
GRANT ALL                    ON public.culture_photos TO service_role;
ALTER TABLE public.culture_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY culture_photos_read ON public.culture_photos
  FOR SELECT TO authenticated
  USING (active = true OR app_private.is_admin(auth.uid()));
CREATE POLICY culture_photos_admin_write ON public.culture_photos
  FOR ALL TO authenticated
  USING (app_private.is_admin(auth.uid()))
  WITH CHECK (app_private.is_admin(auth.uid()));

-- ============ Calendário interno ============
CREATE TABLE IF NOT EXISTS public.culture_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  detail      TEXT,
  event_date  DATE NOT NULL,
  event_type  TEXT NOT NULL DEFAULT 'geral'
                CHECK (event_type IN ('saude', 'celebracao', 'treinamento', 'campanha', 'geral')),
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS culture_events_date_idx ON public.culture_events (event_date);

DROP TRIGGER IF EXISTS trg_culture_events_updated ON public.culture_events;
CREATE TRIGGER trg_culture_events_updated
  BEFORE UPDATE ON public.culture_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT                 ON public.culture_events TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.culture_events TO authenticated;
GRANT ALL                    ON public.culture_events TO service_role;
ALTER TABLE public.culture_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY culture_events_read ON public.culture_events
  FOR SELECT TO authenticated
  USING (active = true OR app_private.is_admin(auth.uid()));
CREATE POLICY culture_events_admin_write ON public.culture_events
  FOR ALL TO authenticated
  USING (app_private.is_admin(auth.uid()))
  WITH CHECK (app_private.is_admin(auth.uid()));

-- ============ "Dar parabéns" no aniversário de casa ============
CREATE TABLE IF NOT EXISTS public.anniversary_congrats (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  to_employee_id   UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  year             INT  NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_employee_id, to_employee_id, year)
);
CREATE INDEX IF NOT EXISTS anniversary_congrats_to_idx ON public.anniversary_congrats (to_employee_id, year);

GRANT SELECT, INSERT, DELETE ON public.anniversary_congrats TO authenticated;
GRANT ALL                    ON public.anniversary_congrats TO service_role;
ALTER TABLE public.anniversary_congrats ENABLE ROW LEVEL SECURITY;

-- A contagem de parabéns é pública ao portal; enviar, só em nome próprio.
CREATE POLICY anniversary_congrats_read ON public.anniversary_congrats
  FOR SELECT TO authenticated USING (true);
CREATE POLICY anniversary_congrats_self_write ON public.anniversary_congrats
  FOR ALL TO authenticated
  USING (from_employee_id = app_private.current_employee_id())
  WITH CHECK (from_employee_id = app_private.current_employee_id());
