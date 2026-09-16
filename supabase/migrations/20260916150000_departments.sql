-- Setores cadastráveis pelo painel
--
-- A lista de setores saía fixa do código (`DEPARTMENTS` em `src/lib/org.ts`). Agora mora nesta
-- tabela, e o G&G cria, renomeia e desativa setores em Gente & Gestão → Setores. O código
-- continua com a lista antiga só como reserva, para o portal não ficar sem opções se a tabela
-- não responder.
--
-- O setor do colaborador continua gravado pelo nome (`employees.department`, TEXT), como na
-- matriz de contatos e no SIM. Por isso, **renomear** um setor aqui troca o nome também nesses
-- lugares (trigger abaixo). Desativar só tira o setor das listas; quem já está nele continua.
--
-- Mesmas regras das outras tabelas de conteúdo: o portal lê os ativos, só admin escreve.
-- Este projeto é anterior à mudança de abril/2026 do Supabase: tabela nova ganha ALL para anon e
-- authenticated pelos privilégios padrão, daí o REVOKE antes dos GRANTs.
--
-- Idempotente.

CREATE TABLE IF NOT EXISTS public.departments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 120),
  order_index  INT NOT NULL DEFAULT 0,
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Nome único sem diferenciar maiúsculas: "Comercial" e "comercial " são o mesmo setor.
CREATE UNIQUE INDEX IF NOT EXISTS departments_name_key ON public.departments (lower(btrim(name)));

REVOKE ALL ON public.departments FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS departments_read ON public.departments;
CREATE POLICY departments_read ON public.departments FOR SELECT TO authenticated
  USING (active OR app_private.is_admin((select auth.uid())));

DROP POLICY IF EXISTS departments_admin_write ON public.departments;
CREATE POLICY departments_admin_write ON public.departments FOR ALL TO authenticated
  USING (app_private.is_admin((select auth.uid())))
  WITH CHECK (app_private.is_admin((select auth.uid())));

DROP TRIGGER IF EXISTS trg_departments_updated ON public.departments;
CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sem espaço sobrando no nome.
CREATE OR REPLACE FUNCTION app_private.departments_trim_name()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.name := btrim(NEW.name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_departments_trim ON public.departments;
CREATE TRIGGER trg_departments_trim BEFORE INSERT OR UPDATE OF name ON public.departments
  FOR EACH ROW EXECUTE FUNCTION app_private.departments_trim_name();

-- Renomear o setor leva o nome novo para onde o antigo estava gravado. SECURITY DEFINER porque
-- o admin, pela API, não tem UPDATE em `employees` (as escritas dali são do servidor); a policy
-- de escrita acima já garante que só admin chega a renomear.
CREATE OR REPLACE FUNCTION app_private.departments_propagate_rename()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.employees
       SET department = NEW.name, updated_at = now()
     WHERE department = OLD.name;
    UPDATE public.contact_matrix
       SET department = NEW.name
     WHERE department = OLD.name;
    UPDATE public.channel_submissions
       SET payload = jsonb_set(payload, '{sector}', to_jsonb(NEW.name))
     WHERE payload->>'sector' = OLD.name;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_private.departments_propagate_rename() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_departments_rename ON public.departments;
CREATE TRIGGER trg_departments_rename AFTER UPDATE OF name ON public.departments
  FOR EACH ROW EXECUTE FUNCTION app_private.departments_propagate_rename();

-- Lista inicial: a mesma que estava no código.
INSERT INTO public.departments (name, order_index)
VALUES
  ('Assistência Técnica', 1),
  ('Comercial', 2),
  ('Faturamento', 3),
  ('Financeiro', 4),
  ('Gente & Gestão', 5),
  ('Logística', 6)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.departments IS
  'Setores oficiais, editados pelo G&G no painel. Renomear propaga para employees, contact_matrix e SIM.';
