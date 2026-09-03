-- Segundo gestor direto
--
-- A planilha do DP traz 32 colaboradores com dois gestores diretos
-- ("JOSÉ ANDERSON / ROBSON LEMES" e "LERCIO BARBOSA / MARITON JUNIOR").
-- `manager_id` é uma coluna só, então o segundo nome ficaria perdido.

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS co_manager_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.employees.co_manager_id IS
  'Segundo gestor direto, quando a área é dividida entre duas pessoas. Opcional.';

CREATE INDEX IF NOT EXISTS employees_co_manager_idx ON public.employees (co_manager_id);

-- A view do portal precisa expor o campo para a aba "Meu time".
DROP VIEW IF EXISTS public.employee_directory;
CREATE VIEW public.employee_directory AS
SELECT
  e.id,
  e.name,
  e.job_title,
  e.department,
  e.unit,
  e.extension,
  e.photo_url,
  e.bio,
  e.admission_date,
  e.manager_id,
  e.co_manager_id,
  EXTRACT(DAY   FROM e.birth_date)::int AS birthday_day,
  EXTRACT(MONTH FROM e.birth_date)::int AS birthday_month
FROM public.employees e
WHERE e.active = true;

REVOKE ALL ON public.employee_directory FROM PUBLIC, anon;
GRANT SELECT ON public.employee_directory TO authenticated;
GRANT ALL    ON public.employee_directory TO service_role;

COMMENT ON VIEW public.employee_directory IS
  'Diretório do portal: só colunas não sensíveis. Aniversário em dia e mês, nunca o ano.';
