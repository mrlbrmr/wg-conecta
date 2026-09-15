-- Matriz de contatos: assunto × departamento
--
-- "Com quem falar sobre férias? E sobre frota, TI, compras?" A resposta muda conforme a área de
-- quem pergunta. Cada linha diz: para este assunto, quem atende este departamento. Linha com
-- departamento vazio vale para todos — é o padrão quando a área não tem um contato específico.
--
-- `department` usa os mesmos nomes de `employees.department` (a lista oficial fica em
-- `src/lib/org.ts`). O painel grava "" quando o G&G escolhe "Todos"; o portal trata "" e NULL
-- do mesmo jeito.
--
-- Mesmas regras das outras tabelas de conteúdo: o portal lê as ativas, só admin escreve.
-- `(select auth.uid())` em vez de `auth.uid()`: o Postgres calcula uma vez por consulta, não
-- uma vez por linha (recomendação do Supabase para policies).
--
-- GRANT explícito de propósito: a partir de 30/10/2026 tabela nova em `public` não fica mais
-- exposta à API de dados sem ele (changelog 45329 do Supabase).

CREATE TABLE IF NOT EXISTS public.contact_matrix (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject       TEXT NOT NULL,
  department    TEXT,
  contact_name  TEXT NOT NULL,
  contact_role  TEXT,
  phone         TEXT,
  extension     TEXT,
  email         TEXT,
  notes         TEXT,
  order_index   INT NOT NULL DEFAULT 0,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contact_matrix_department_idx ON public.contact_matrix (department);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_matrix TO authenticated;
GRANT ALL ON public.contact_matrix TO service_role;
ALTER TABLE public.contact_matrix ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contact_matrix_read ON public.contact_matrix;
CREATE POLICY contact_matrix_read ON public.contact_matrix FOR SELECT TO authenticated
  USING (active OR app_private.is_admin((select auth.uid())));

DROP POLICY IF EXISTS contact_matrix_admin_write ON public.contact_matrix;
CREATE POLICY contact_matrix_admin_write ON public.contact_matrix FOR ALL TO authenticated
  USING (app_private.is_admin((select auth.uid())))
  WITH CHECK (app_private.is_admin((select auth.uid())));

DROP TRIGGER IF EXISTS trg_contact_matrix_updated ON public.contact_matrix;
CREATE TRIGGER trg_contact_matrix_updated BEFORE UPDATE ON public.contact_matrix
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.contact_matrix IS
  'Com quem falar: para cada assunto, o contato de cada departamento. department vazio = vale para todos.';
