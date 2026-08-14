-- Tabela de colaboradores vinculada ao Supabase Auth
CREATE TABLE public.employees (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  department TEXT,
  job_title  TEXT,
  active     BOOLEAN NOT NULL DEFAULT true,
  invited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Admins gerenciam todos os colaboradores
CREATE POLICY "employees_admin_all" ON public.employees
  FOR ALL TO authenticated
  USING (app_private.is_admin(auth.uid()))
  WITH CHECK (app_private.is_admin(auth.uid()));

-- Colaborador lê o próprio registro
CREATE POLICY "employees_self_read" ON public.employees
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Colaborador atualiza o próprio registro
CREATE POLICY "employees_self_update" ON public.employees
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Helper: verifica se um uid é colaborador ativo
CREATE OR REPLACE FUNCTION app_private.is_employee(uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees WHERE id = uid AND active = true
  );
$$;
