-- Correção de papéis + helper de identidade do colaborador
--
-- Contexto: a migration inicial criou o trigger `on_auth_user_created_admin`,
-- que insere TODA nova linha de auth.users em admin_users com active = true.
-- Como app_private.is_admin() é exatamente "existe em admin_users e está ativo",
-- cada colaborador convidado para o portal virava admin — e qualquer RLS
-- baseada em papel deixa de valer. O trigger só era removido em
-- setup_completo.sql, que pode nunca ter rodado neste projeto.

-- 1. Derruba a promoção automática a admin (idempotente)
DROP TRIGGER IF EXISTS on_auth_user_created_admin ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_admin_user();

-- 2. Helper: id do colaborador do usuário autenticado.
--    Resolve por auth_user_id e cai para id — vínculos antigos gravaram só o id.
CREATE OR REPLACE FUNCTION app_private.current_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.employees
  WHERE active = true
    AND (auth_user_id = auth.uid() OR id = auth.uid())
  ORDER BY (auth_user_id = auth.uid()) DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION app_private.current_employee_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.current_employee_id() TO authenticated, service_role;

-- 3. Limpeza dos admins criados por engano — NÃO roda automaticamente.
--    Confira a lista antes e remova só quem não é de Gente & Gestão:
--
--    SELECT a.id, a.email, a.active,
--           EXISTS (SELECT 1 FROM public.employees e WHERE e.auth_user_id = a.id) AS e_colaborador
--    FROM public.admin_users a
--    ORDER BY a.email;
--
--    UPDATE public.admin_users SET active = false WHERE email IN ( ... );
