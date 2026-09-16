-- Atalhos da home ("Onde a gente vai agora") com conteúdo próprio
--
-- O G&G quer colocar tutoriais (texto formatado + vídeo do Drive/YouTube) nos atalhos. Cada
-- atalho ganha `content` (Markdown, o mesmo formato da FAQ). Quem tem conteúdo abre a página
-- `/atalhos/<id>` do portal.
--
-- `url` continua obrigatória: quando o atalho só tem conteúdo, o gatilho abaixo preenche
-- `/atalhos/<id>`. Assim o card da home, o corpus do Baterito e qualquer outra leitura de
-- `url` continuam funcionando sem mudança.
--
-- Tabela já existente: nenhum GRANT muda. As políticas de leitura (`quick_links_read_active`) e
-- de escrita (`quick_links_admin_write`) continuam as mesmas.

ALTER TABLE public.quick_links ADD COLUMN IF NOT EXISTS content TEXT;

COMMENT ON COLUMN public.quick_links.content IS
  'Tutorial do atalho, em Markdown (negrito, listas, links; linha com link do Drive/YouTube vira vídeo). Com conteúdo, o atalho abre /atalhos/<id>.';

CREATE OR REPLACE FUNCTION app_private.quick_links_fill_url()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(btrim(NEW.url), '') = '' AND COALESCE(btrim(NEW.content), '') <> '' THEN
    NEW.url := '/atalhos/' || NEW.id::text;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_private.quick_links_fill_url() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS quick_links_fill_url ON public.quick_links;
CREATE TRIGGER quick_links_fill_url
  BEFORE INSERT OR UPDATE OF url, content ON public.quick_links
  FOR EACH ROW EXECUTE FUNCTION app_private.quick_links_fill_url();

-- Atalho sem link e sem conteúdo não leva a lugar nenhum. NOT VALID: não reprova linhas antigas.
ALTER TABLE public.quick_links DROP CONSTRAINT IF EXISTS quick_links_url_or_content;
ALTER TABLE public.quick_links
  ADD CONSTRAINT quick_links_url_or_content CHECK (btrim(url) <> '') NOT VALID;
