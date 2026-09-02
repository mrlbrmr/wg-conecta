-- Campos cadastrais que o colaborador pode pedir atualização pelo portal.
-- Necessários porque a aprovação da solicitação grava os valores em employees.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS marital_status     TEXT,
  ADD COLUMN IF NOT EXISTS education_level    TEXT,
  ADD COLUMN IF NOT EXISTS dependents         TEXT,
  ADD COLUMN IF NOT EXISTS address_zip        TEXT,
  ADD COLUMN IF NOT EXISTS address_street     TEXT,
  ADD COLUMN IF NOT EXISTS address_number     TEXT,
  ADD COLUMN IF NOT EXISTS address_complement TEXT,
  ADD COLUMN IF NOT EXISTS address_district   TEXT,
  ADD COLUMN IF NOT EXISTS address_city       TEXT,
  ADD COLUMN IF NOT EXISTS address_state      TEXT;
