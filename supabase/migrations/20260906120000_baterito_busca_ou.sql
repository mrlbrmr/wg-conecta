-- Baterito: a busca precisa de OU entre os termos, não E.
--
-- `websearch_to_tsquery` combina os termos com AND. Numa pergunta escrita como
-- gente escreve — "Como tirar o holerite?" — isso vira `'tir' & 'holerit'`, e
-- exige que o documento contenha as duas coisas. Nenhum material de G&G diz
-- "tirar"; eles dizem "holerite", "contracheque", "folha". Resultado: a busca
-- voltava vazia para quase tudo e o assistente caía no encaminhamento sempre,
-- como se a base não existisse.
--
-- Agora os lexemas da pergunta são combinados com `|`, e o `ts_rank` faz o
-- trabalho de ordenar: quem casa mais termos sobe. O documento sobre holerite
-- aparece mesmo que ninguém tenha escrito "tirar" nele.

CREATE OR REPLACE FUNCTION public.baterito_search(q text, max_rows integer DEFAULT 8)
RETURNS TABLE (source text, title text, url text, content text, rank real)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
  WITH termos AS (
    -- Os lexemas saem do próprio `to_tsvector`, então já vêm normalizados e sem
    -- stopword. `quote_literal` protege o tsquery de qualquer resto estranho, e
    -- o NULLIF cobre a pergunta que era só stopword: aí não há o que buscar.
    SELECT to_tsquery(
             'portuguese',
             NULLIF(
               array_to_string(
                 ARRAY(
                   SELECT quote_literal(lexeme)
                     FROM unnest(to_tsvector('portuguese', unaccent(q)))
                 ),
                 ' | '
               ),
               ''
             )
           ) AS tq
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
   WHERE t.tq IS NOT NULL
     AND i.tsv @@ t.tq
   ORDER BY rank DESC
   LIMIT LEAST(GREATEST(max_rows, 1), 20);
$$;

COMMENT ON FUNCTION public.baterito_search(text, integer) IS
  'Busca full-text em português no conteúdo publicado do portal, com OU entre os termos da pergunta e ordenação por ts_rank. Devolve título e rota para o bloco "Fonte" do assistente. O tsvector é calculado na hora: o corpus tem dezenas de linhas por tabela. Se alguma delas passar de alguns milhares, trocar por coluna gerada + índice GIN.';

REVOKE ALL ON FUNCTION public.baterito_search(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.baterito_search(text, integer) TO service_role;
