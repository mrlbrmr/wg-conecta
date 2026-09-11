-- Opção de não exibir o aniversário no portal
--
-- Há colaboradores que não comemoram aniversário (por religião, por exemplo) e não querem
-- aparecer em "Aniversariantes". Apagar a data de nascimento não serve: ela é dado do DP, e
-- reimportar a planilha a traria de volta. O flag esconde sem perder o dado.
--
-- Tudo o que o portal mostra de aniversário sai de `employee_directory` — home, Cultura, KPI
-- do painel e o documento "Aniversariantes de <mês>" do Baterito (`baterito_search` filtra
-- `birthday_day IS NOT NULL`). Com a view devolvendo NULL, a pessoa some de todos de uma vez.
-- Tempo de casa (`admission_date`) continua aparecendo.
--
-- Em 11/09/2026 a view no banco ainda era a de `20260903120100` (sem `co_manager_id`): a parte
-- da view de `20260903121100_employees_co_manager.sql` não tinha rodado. Por isso esta
-- migration garante a coluna e recria a view inteira (DROP + CREATE), em vez de
-- `CREATE OR REPLACE`, que exige as mesmas colunas na mesma ordem.

-- ── Coluna nova ───────────────────────────────────────────────────────
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS hide_birthday BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.employees.hide_birthday IS
  'Não exibir o aniversário no portal. A data continua guardada. Só o G&G altera.';

-- Fora do GRANT UPDATE por coluna de `20260903120100`: o colaborador não altera pela API.
-- O pedido chega ao G&G, que marca pelo painel.

-- ── O que faltou de 20260903121100 (idempotente) ──────────────────────
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS co_manager_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.employees.co_manager_id IS
  'Segundo gestor direto, quando a área é dividida entre duas pessoas. Opcional.';

CREATE INDEX IF NOT EXISTS employees_co_manager_idx ON public.employees (co_manager_id);

-- ── View do diretório ─────────────────────────────────────────────────
-- `baterito_search` lê a view, mas tem corpo em string (LANGUAGE sql AS $$…$$): não há
-- dependência registrada, e o DROP não é bloqueado. Sem CASCADE de propósito — se aparecer
-- outra dependência, a migration falha inteira em vez de apagar algo em silêncio.
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
  CASE WHEN e.hide_birthday THEN NULL ELSE EXTRACT(DAY   FROM e.birth_date)::int END AS birthday_day,
  CASE WHEN e.hide_birthday THEN NULL ELSE EXTRACT(MONTH FROM e.birth_date)::int END AS birthday_month
FROM public.employees e
WHERE e.active = true;

REVOKE ALL ON public.employee_directory FROM PUBLIC, anon;
GRANT SELECT ON public.employee_directory TO authenticated;
GRANT ALL    ON public.employee_directory TO service_role;

COMMENT ON VIEW public.employee_directory IS
  'Diretório do portal: só colunas não sensíveis. Aniversário em dia e mês, nunca o ano, e NULL quando hide_birthday.';
