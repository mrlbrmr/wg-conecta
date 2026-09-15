-- Cargo sem senioridade no portal
--
-- O G&G pediu para o portal não mostrar o nível do cargo ("Analista Financeiro Pleno",
-- "Auxiliar de Logística II"). O cargo completo é dado do DP: continua em `employees.job_title`,
-- no painel e na planilha. Só a vitrine muda — e, como tudo o que o portal mostra sobre colegas
-- sai de `employee_directory` (home, Cultura, Meu time, Integração, busca e o corpus do
-- Baterito), basta a view devolver o cargo limpo.
--
-- A regra está espelhada em `src/lib/job-title.ts` (`publicJobTitle`), usada no cabeçalho do
-- próprio perfil, que lê `employees` e não a view. Mudou aqui, muda lá.
--
-- Expressão inline em vez de função: numa view, quem consulta precisa de EXECUTE em cada
-- função chamada, e `authenticated` não tem acesso a `app_private`.
--
-- Colunas, nomes e ordem idênticos aos de 20260911130000, então CREATE OR REPLACE basta.

CREATE OR REPLACE VIEW public.employee_directory AS
SELECT
  e.id,
  e.name,
  COALESCE(
    NULLIF(
      btrim(
        regexp_replace(                                   -- 5. separador que sobrou no fim
          regexp_replace(                                 -- 4. espaços duplos
            regexp_replace(                               -- 3. nível no fim: I, II, III, IV, "Nível 2"
              regexp_replace(                             -- 2. parênteses que ficaram vazios
                regexp_replace(                           -- 1. Jr, Júnior, Pl, Pleno, Sr, Sênior, Trainee
                  e.job_title,
                  '\m(jr|j[uúÚ]nior|pl|pleno|sr|s[eêÊ]nior|trainee)\M\.?', '', 'gi'),
                '\(\s*\)', '', 'g'),
              '\s+(i{1,3}|iv|n[iíÍ]vel\s*\S+)\s*$', '', 'i'),
            '\s{2,}', ' ', 'g'),
          '[\s–/|,.-]+$', '')
      ),
      ''),
    e.job_title                                           -- cargo que era só o nível: mostra como veio
  ) AS job_title,
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
  'Diretório do portal: só colunas não sensíveis. Cargo sem senioridade. Aniversário em dia e mês, nunca o ano, e NULL quando hide_birthday.';
