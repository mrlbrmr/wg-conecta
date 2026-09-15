-- Filial de volta para `unit`
--
-- `unit` é a filial (onde a pessoa trabalha) e `department` é o setor (o que ela faz) — a
-- semântica de 20260903120100. Só que o importador de planilha gravava a coluna "Filial" em
-- `department`, e o cadastro manual chamava o campo de "Filial / Departamento". Resultado:
-- `unit` vazia e cidade no lugar da área. O importador já foi corrigido; esta migration arruma
-- o que foi gravado antes.
--
-- Regra: se `department` tem o nome de uma das seis filiais (lista do SIM, também em
-- `src/lib/org.ts`), o valor vai para `unit` — sem sobrescrever uma `unit` já preenchida — e
-- `department` fica vazio, porque aquilo nunca foi um setor. Setor vazio é o que permite à
-- próxima importação (que só completa campos vazios) gravar o setor certo.
--
-- De quebra, `unit` já preenchida passa para o nome oficial ("SJP" → "São José dos Pinhais/PR").
--
-- Idempotente: rodar de novo não acha mais nada para mover.

CREATE OR REPLACE FUNCTION pg_temp.official_unit(raw text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN k LIKE '%campinas%'                               THEN 'Campinas/SP'
    WHEN k LIKE '%maringa%'                                THEN 'Maringá/PR'
    WHEN k LIKE '%novaiguacu%'                             THEN 'Nova Iguaçu/RJ'
    WHEN k LIKE '%saobernardo%' OR k LIKE '%sbc%'          THEN 'São Bernardo do Campo/SP'
    WHEN k LIKE '%saojosedospinhais%' OR k LIKE '%sjp%'    THEN 'São José dos Pinhais/PR'
    WHEN k LIKE '%saopaulo%'                               THEN 'São Paulo/SP'
  END
  FROM (
    -- Sem acento (antes do lower, que em locale C não mexe em letra acentuada), minúsculo e
    -- só letras e dígitos: "SÃO JOSÉ DOS PINHAIS - PR" → "saojosedospinhaispr".
    SELECT regexp_replace(
             lower(translate(raw,
               'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç',
               'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')),
             '[^a-z0-9]', '', 'g') AS k
  ) f
$$;

-- 1. Filial gravada como setor.
UPDATE public.employees
   SET unit       = COALESCE(unit, pg_temp.official_unit(department)),
       department = NULL,
       updated_at = now()
 WHERE department IS NOT NULL
   AND pg_temp.official_unit(department) IS NOT NULL;

-- 2. Filial já em `unit`, mas escrita de outro jeito.
UPDATE public.employees
   SET unit       = pg_temp.official_unit(unit),
       updated_at = now()
 WHERE unit IS NOT NULL
   AND pg_temp.official_unit(unit) IS NOT NULL
   AND unit <> pg_temp.official_unit(unit);
