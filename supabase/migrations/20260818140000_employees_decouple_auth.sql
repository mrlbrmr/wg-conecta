-- Desacopla employees de auth.users
-- Permite colaboradores no diretório sem conta no portal

-- 1. Remove FK de id → auth.users (pode ter nome gerado automaticamente)
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.employees'::regclass
    AND contype = 'f'
    AND conkey = ARRAY[(
      SELECT attnum FROM pg_attribute
      WHERE attrelid = 'public.employees'::regclass AND attname = 'id'
    )];
  IF cname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.employees DROP CONSTRAINT ' || quote_ident(cname);
  END IF;
END $$;

-- 2. Torna email opcional (colaboradores sem acesso ao portal não precisam de email)
ALTER TABLE public.employees ALTER COLUMN email DROP NOT NULL;

-- 3. Adiciona auth_user_id: FK opcional para auth.users (acesso ao portal)
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 4. Retroativamente define auth_user_id = id para quem já tem conta
UPDATE public.employees SET auth_user_id = id WHERE auth_user_id IS NULL;

-- 5. Índice único em auth_user_id (apenas um employee por auth user)
CREATE UNIQUE INDEX IF NOT EXISTS employees_auth_user_id_key
  ON public.employees (auth_user_id) WHERE auth_user_id IS NOT NULL;

-- 6. Atualiza políticas RLS para usar auth_user_id
DROP POLICY IF EXISTS "employees_self_read" ON public.employees;
DROP POLICY IF EXISTS "employees_self_update" ON public.employees;

CREATE POLICY "employees_self_read" ON public.employees
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "employees_self_update" ON public.employees
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- 7. Atualiza helper is_employee para usar auth_user_id
CREATE OR REPLACE FUNCTION app_private.is_employee(uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees WHERE auth_user_id = uid AND active = true
  );
$$;
