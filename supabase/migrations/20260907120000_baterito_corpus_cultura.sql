-- Baterito: o corpus passa a cobrir o que é vida do portal, não só documento.
--
-- Até aqui a busca via políticas, benefícios, vagas e formulários. Ficavam de
-- fora justamente as perguntas mais frequentes do dia a dia: quem faz
-- aniversário, quem está completando tempo de casa, quem chegou agora, o que
-- tem de campanha e de comunicado no ar.
--
-- Aniversariantes, tempo de casa e admissões entram como **documentos
-- agregados**, um por assunto, montados na hora com o recorte do mês — não como
-- uma linha por pessoa. Três razões:
--
--   1. A pergunta é temporal ("quem faz aniversário este mês"), não lexical.
--      Busca full-text sobre 135 fichas nunca responderia isso; um documento
--      cujo título é "Aniversariantes de setembro" responde.
--   2. Mantém o corpus pequeno e o ranking limpo.
--   3. Limita o dado pessoal que chega ao modelo a quem é do mês, em vez do
--      diretório inteiro.
--
-- A fonte é sempre `employee_directory`, a view que o portal já usa: sem
-- e-mail, sem telefone, sem data de nascimento completa — só dia e mês.

CREATE OR REPLACE FUNCTION public.baterito_search(q text, max_rows integer DEFAULT 8)
RETURNS TABLE (source text, title text, url text, content text, rank real)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
  WITH termos AS (
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
  -- `to_char(..., 'TMMonth')` depende do lc_time do servidor, que não é
  -- garantido. O nome do mês sai daqui, em português, sempre.
  hoje AS (
    SELECT current_date AS d,
           extract(month FROM current_date)::int AS mes,
           extract(year  FROM current_date)::int AS ano,
           (ARRAY['janeiro','fevereiro','março','abril','maio','junho',
                  'julho','agosto','setembro','outubro','novembro','dezembro']
            )[extract(month FROM current_date)::int] AS mes_nome
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
           concat_ws(E'\n', 'Contato de Gente e Gestão', c.name, c.area, c.description)
      FROM public.contacts c
     WHERE c.active

    -- ============ Vida do portal ============

    -- Comunicados no ar. É o "o que há de novidade".
    UNION ALL
    SELECT 'comunicado', a.title, '/mural/' || a.id,
           concat_ws(E'\n', 'Comunicado', a.title, a.lead, a.summary, a.content,
                     a.category, array_to_string(a.tags, ' '))
      FROM public.announcements a
     WHERE a.status = 'publicado'
       AND (a.expires_at IS NULL OR a.expires_at > now())

    UNION ALL
    SELECT 'campanha', c.title, COALESCE(c.external_url, '/'),
           concat_ws(E'\n', 'Campanha ativa', c.title, c.description)
      FROM public.campaigns c
     WHERE c.active
       AND (c.start_date IS NULL OR c.start_date <= current_date)
       AND (c.end_date   IS NULL OR c.end_date   >= current_date)

    UNION ALL
    SELECT 'evento', e.title, '/cultura',
           concat_ws(E'\n', 'Evento da cultura WG', e.title, e.detail, e.event_type,
                     to_char(e.event_date, 'DD/MM/YYYY'))
      FROM public.culture_events e
     WHERE e.active

    UNION ALL
    SELECT 'reconhecimento', r.title, '/cultura',
           concat_ws(E'\n', 'Reconhecimento', r.title, r.person_or_team, r.description,
                     to_char(r.recognition_date, 'DD/MM/YYYY'))
      FROM public.recognitions r
     WHERE r.active

    UNION ALL
    SELECT 'integracao', m.title, '/integracao',
           concat_ws(E'\n', 'Material de integração', m.title, m.description, m.content,
                     m.category, m.material_type)
      FROM public.onboarding_materials m
     WHERE m.active

    -- ============ Agregados do mês ============

    UNION ALL
    SELECT 'aniversariantes',
           'Aniversariantes de ' || h.mes_nome,
           '/cultura',
           'Aniversariantes de ' || h.mes_nome || ' — quem faz aniversário, niver, '
             || 'data de nascimento do mês:' || E'\n'
             || string_agg(e.name || ' — dia ' || e.birthday_day, E'\n'
                           ORDER BY e.birthday_day)
      FROM public.employee_directory e, hoje h
     WHERE e.birthday_month = h.mes
       AND e.birthday_day IS NOT NULL
     GROUP BY h.mes_nome

    UNION ALL
    SELECT 'tempo-de-casa',
           'Tempo de casa em ' || h.mes_nome,
           '/cultura',
           'Aniversário de empresa, tempo de casa e anos de WG em ' || h.mes_nome || ':'
             || E'\n'
             || string_agg(
                  e.name || ' — ' || (h.ano - extract(year FROM e.admission_date)::int)
                    || ' ano(s), desde ' || to_char(e.admission_date, 'DD/MM/YYYY'),
                  E'\n' ORDER BY e.admission_date)
      FROM public.employee_directory e, hoje h
     WHERE e.admission_date IS NOT NULL
       AND extract(month FROM e.admission_date)::int = h.mes
       AND extract(year  FROM e.admission_date)::int < h.ano
     GROUP BY h.mes_nome

    UNION ALL
    SELECT 'novas-admissoes',
           'Novas admissões',
           '/cultura',
           'Quem chegou agora, novas admissões e contratações dos últimos 60 dias:'
             || E'\n'
             || string_agg(
                  e.name || COALESCE(' — ' || e.job_title, '')
                    || COALESCE(' (' || e.unit || ')', '')
                    || ', desde ' || to_char(e.admission_date, 'DD/MM/YYYY'),
                  E'\n' ORDER BY e.admission_date DESC)
      FROM public.employee_directory e, hoje h
     WHERE e.admission_date IS NOT NULL
       AND e.admission_date >= h.d - 60
       AND e.admission_date <= h.d
     GROUP BY h.d
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
  'Busca full-text em português sobre o conteúdo publicado do portal e sobre a vida dele — comunicados, campanhas, eventos, reconhecimentos, integração — mais três documentos agregados do mês: aniversariantes, tempo de casa e novas admissões, montados a partir da view employee_directory. Devolve título e rota para o bloco "Fonte" do assistente.';

REVOKE ALL ON FUNCTION public.baterito_search(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.baterito_search(text, integer) TO service_role;
