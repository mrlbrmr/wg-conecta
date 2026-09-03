-- Assistente Baterito: busca na base de conhecimento + registro de perguntas.
--
-- A base de conhecimento do assistente NÃO é uma tabela nova. O conteúdo oficial
-- de Gente & Gestão já está publicado no portal (`faq_items`, `benefits`,
-- `documents`, `gg_pages`, `internal_jobs`, `quick_links`, `forms`,
-- `monthly_deadlines`, `contacts`) e é editado pelo painel administrativo.
-- Criar um `kb_documents` paralelo obrigaria o time a publicar duas vezes e a
-- base do Baterito envelheceria sozinha. Em vez disso, `baterito_search()` une
-- essas tabelas numa busca full-text e devolve, junto do trecho, a rota do
-- portal — é ela que vira o bloco "Fonte" da resposta.

-- `unaccent` porque ninguém digita "férias" com acento no meio de uma pergunta.
-- O dicionário `portuguese` faz o stemming; o unaccent normaliza a acentuação.
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- ============ Busca na base de conhecimento ============

DROP FUNCTION IF EXISTS public.baterito_search(text, integer);

CREATE FUNCTION public.baterito_search(q text, max_rows integer DEFAULT 8)
RETURNS TABLE (source text, title text, url text, content text, rank real)
LANGUAGE sql
STABLE
-- search_path explícito, não vazio: a configuração de busca 'portuguese' e o
-- dicionário do unaccent são resolvidos por ele. A função não é SECURITY
-- DEFINER, então roda com os privilégios de quem chama (a service role).
SET search_path = pg_catalog, public, extensions
AS $$
  WITH termos AS (
    SELECT websearch_to_tsquery('portuguese', unaccent(q)) AS tq
  ),
  corpus AS (
    SELECT 'faq'::text AS source,
           f.question   AS title,
           '/gente-gestao/faq'::text AS url,
           concat_ws(E'\n', f.question, f.answer, array_to_string(f.tags, ' ')) AS content
      FROM public.faq_items f
     WHERE f.active

    UNION ALL
    SELECT 'beneficio', b.title, '/gente-gestao/beneficios',
           concat_ws(E'\n', b.title, b.description, b.eligibility, b.observation)
      FROM public.benefits b
     WHERE b.active

    UNION ALL
    SELECT 'documento', d.title, '/gente-gestao/documentos',
           concat_ws(E'\n', d.title, d.description, array_to_string(d.tags, ' '))
      FROM public.documents d
     WHERE d.active

    -- page_key é exatamente o último segmento da rota: /gente-gestao/ferias etc.
    UNION ALL
    SELECT 'pagina', g.title, '/gente-gestao/' || g.page_key,
           concat_ws(E'\n', g.title, g.body)
      FROM public.gg_pages g
     WHERE g.active

    UNION ALL
    SELECT 'vaga', j.title, '/vagas',
           concat_ws(E'\n', j.title, j.summary, j.requirements, j.location, j.unit)
      FROM public.internal_jobs j
     WHERE j.status <> 'encerrada'

    UNION ALL
    SELECT 'atalho', l.title, l.url,
           concat_ws(E'\n', l.title, l.description)
      FROM public.quick_links l
     WHERE l.active

    -- Formulário interno mora numa rota; o externo continua levando para fora.
    UNION ALL
    SELECT 'formulario', fo.title,
           COALESCE('/formularios/' || fo.slug, fo.external_url),
           concat_ws(E'\n', fo.title, fo.description)
      FROM public.forms fo
     WHERE fo.active

    UNION ALL
    SELECT 'prazo', p.label, '/gente-gestao',
           concat_ws(' ', p.label, 'prazo', to_char(p.due_date, 'DD/MM/YYYY'))
      FROM public.monthly_deadlines p
     WHERE p.active

    UNION ALL
    SELECT 'contato', c.name, '/gente-gestao/contatos',
           concat_ws(E'\n', c.name, c.area, c.description)
      FROM public.contacts c
     WHERE c.active
  ),
  indexado AS (
    SELECT c.*, to_tsvector('portuguese', unaccent(c.content)) AS tsv
      FROM corpus c
     WHERE c.url IS NOT NULL
  )
  SELECT i.source, i.title, i.url, i.content, ts_rank(i.tsv, t.tq) AS rank
    FROM indexado i, termos t
   WHERE i.tsv @@ t.tq
   ORDER BY rank DESC
   LIMIT LEAST(GREATEST(max_rows, 1), 20);
$$;

COMMENT ON FUNCTION public.baterito_search(text, integer) IS
  'Busca full-text em português no conteúdo publicado do portal. Devolve título e rota para o bloco "Fonte" do assistente. O tsvector é calculado na hora: o corpus tem dezenas de linhas por tabela. Se alguma delas passar de alguns milhares, trocar por coluna gerada + índice GIN.';

-- Só o endpoint chama, e ele roda com a service role. Nenhuma sessão de
-- colaborador precisa (nem deve) executar isto via PostgREST.
REVOKE ALL ON FUNCTION public.baterito_search(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.baterito_search(text, integer) TO service_role;

-- ============ Registro de perguntas ============

-- Duas funções num registro só: freia o abuso (contagem por usuário na última
-- hora) e entrega ao time de G&G a lista do que o Baterito não soube responder,
-- que é o principal indicador de que a base precisa crescer.
CREATE TABLE IF NOT EXISTS public.baterito_queries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  question   TEXT NOT NULL,
  answered   BOOLEAN NOT NULL,
  sources    TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.baterito_queries IS
  'Uma linha por pergunta feita ao Baterito. Retenção de 90 dias — ver o job em supabase/MIGRATIONS.md.';
COMMENT ON COLUMN public.baterito_queries.question IS
  'Pergunta com PII mascarada na aplicação (CPF, telefone, cartão) antes de chegar aqui.';
COMMENT ON COLUMN public.baterito_queries.answered IS
  'false = caiu no encaminhamento para G&G. É a lista de trabalho de conteúdo.';

-- Rate limit: conta as perguntas de um usuário na última hora.
CREATE INDEX IF NOT EXISTS baterito_queries_user_idx
  ON public.baterito_queries (user_id, created_at DESC);

-- Relatório de lacunas. Parcial porque só as não respondidas interessam, e elas
-- são a minoria — o índice fica uma fração do tamanho do total.
CREATE INDEX IF NOT EXISTS baterito_queries_unanswered_idx
  ON public.baterito_queries (created_at DESC) WHERE NOT answered;

ALTER TABLE public.baterito_queries ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy de INSERT: só o endpoint escreve, com a service role, que
-- passa por cima do RLS. O colaborador não lê nem a própria linha — o histórico
-- dele vive no navegador, e aqui é instrumento de G&G.
DROP POLICY IF EXISTS baterito_queries_admin_read ON public.baterito_queries;
CREATE POLICY baterito_queries_admin_read ON public.baterito_queries
  FOR SELECT TO authenticated
  USING (app_private.is_admin(auth.uid()));
