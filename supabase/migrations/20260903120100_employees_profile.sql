-- Campos de perfil do colaborador + diretório interno

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS bio        TEXT,
  ADD COLUMN IF NOT EXISTS unit       TEXT,
  ADD COLUMN IF NOT EXISTS extension  TEXT,
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS buddy_id   UUID REFERENCES public.employees(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.employees.unit      IS 'Filial: SJP, RJ, SP, LDA, MGÁ, SBC, SUM. O setor fica em department.';
COMMENT ON COLUMN public.employees.extension IS 'Ramal interno. Telefone pessoal não aparece no portal.';
COMMENT ON COLUMN public.employees.buddy_id  IS 'Padrinho de integração.';

CREATE INDEX IF NOT EXISTS employees_manager_idx    ON public.employees (manager_id);
CREATE INDEX IF NOT EXISTS employees_department_idx ON public.employees (department);

-- O colaborador edita apenas as próprias colunas editáveis.
-- RLS não filtra coluna: quem faz isso é o GRANT por coluna.
-- Cargo, área, unidade, admissão e nascimento vêm do DP e seguem somente-leitura;
-- o caminho para corrigi-los é abrir solicitação para G&G.
REVOKE UPDATE ON public.employees FROM authenticated;
GRANT UPDATE (bio, extension, email, photo_url, updated_at) ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;

-- Diretório interno: colunas seguras de todo colaborador ativo.
-- View security definer (padrão) para atravessar o RLS de employees, que só
-- libera o próprio registro. Sem e-mail, sem telefone, sem data de nascimento
-- completa — o aniversário sai só como dia e mês.
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
  EXTRACT(DAY   FROM e.birth_date)::int AS birthday_day,
  EXTRACT(MONTH FROM e.birth_date)::int AS birthday_month
FROM public.employees e
WHERE e.active = true;

REVOKE ALL ON public.employee_directory FROM PUBLIC, anon;
GRANT SELECT ON public.employee_directory TO authenticated;
GRANT ALL    ON public.employee_directory TO service_role;

COMMENT ON VIEW public.employee_directory IS
  'Diretório do portal: só colunas não sensíveis. Aniversário em dia e mês, nunca o ano.';
