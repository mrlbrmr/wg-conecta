-- Unidade (filial / centro de distribuição) do colaborador.
-- Usada nas telas de Cultura (aniversários e tempo de casa) como filtro e coluna.
-- O campo já existia em birthdays/work_anniversaries; employees é a fonte única.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS unit TEXT;
