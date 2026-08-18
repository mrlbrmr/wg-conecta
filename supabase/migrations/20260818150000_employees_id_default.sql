-- Adiciona default para id poder ser gerado automaticamente
-- (antes era sempre fornecido pelo auth.users; agora pode vir da importação)
ALTER TABLE public.employees ALTER COLUMN id SET DEFAULT gen_random_uuid();
