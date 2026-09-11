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

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS hide_birthday BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.employees.hide_birthday IS
  'Não exibir o aniversário no portal. A data continua guardada. Só o G&G altera.';

-- Fora do GRANT UPDATE por coluna de `20260903120100`: o colaborador não altera pela API.
-- O pedido chega ao G&G, que marca pelo painel.

-- CREATE OR REPLACE (e não DROP + CREATE): mesmas colunas e tipos, e preserva os grants.
CREATE OR REPLACE VIEW public.employee_directory AS
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

COMMENT ON VIEW public.employee_directory IS
  'Diretório do portal: só colunas não sensíveis. Aniversário em dia e mês, nunca o ano, e NULL quando hide_birthday.';
