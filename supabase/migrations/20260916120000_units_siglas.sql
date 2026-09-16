-- Filiais gravadas como sigla
--
-- A planilha do DP traz algumas filiais só pela sigla ("RJ", "SP", "SUM"), e a importação
-- guardava do jeito que vinha. O importador já reconhece as siglas (`src/lib/org.ts`); esta
-- migration arruma o que foi gravado antes, em `employees.unit` e `internal_jobs.unit`.
--
--   RJ  → Nova Iguaçu/RJ
--   SP  → São Paulo/SP
--   SUM → Sumaré/SP (filial nova na lista oficial)
--
-- Só a sigla sozinha (ignorando espaços e maiúsculas) é trocada: "Campinas/SP" fica como está.
-- Idempotente: rodar de novo não acha mais nada.

UPDATE public.employees
   SET unit = CASE upper(trim(unit))
                WHEN 'RJ'  THEN 'Nova Iguaçu/RJ'
                WHEN 'SP'  THEN 'São Paulo/SP'
                WHEN 'SUM' THEN 'Sumaré/SP'
              END,
       updated_at = now()
 WHERE upper(trim(unit)) IN ('RJ', 'SP', 'SUM');

UPDATE public.internal_jobs
   SET unit = CASE upper(trim(unit))
                WHEN 'RJ'  THEN 'Nova Iguaçu/RJ'
                WHEN 'SP'  THEN 'São Paulo/SP'
                WHEN 'SUM' THEN 'Sumaré/SP'
              END
 WHERE upper(trim(unit)) IN ('RJ', 'SP', 'SUM');
