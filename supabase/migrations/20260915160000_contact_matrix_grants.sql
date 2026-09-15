-- Permissões de `contact_matrix` só as necessárias
--
-- A conferência depois de `20260915150000_contact_matrix.sql` mostrou `anon` com SELECT na
-- tabela. A causa: este projeto é anterior à mudança de abril/2026 do Supabase (changelog
-- 45329), e os privilégios padrão do schema `public` ainda dão ALL em toda tabela nova para
-- `anon` e `authenticated`. A migration fez GRANT para `authenticated`, mas não o REVOKE.
--
-- Não houve exposição: RLS ligada e as duas policies são `TO authenticated`, então `anon` lia
-- zero linhas e não gravava nada. Mas grant é a primeira camada, e a RLS não cobre TRUNCATE.
-- Aqui fica exatamente o que o portal e o painel usam.
--
-- Idempotente.

REVOKE ALL ON public.contact_matrix FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_matrix TO authenticated;
GRANT ALL ON public.contact_matrix TO service_role;
